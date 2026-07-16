"""Functional and security contracts for the local Assistant control-plane bridge."""

from __future__ import annotations

import ast
import asyncio
import importlib
import json
import os
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import ClassVar
from unittest import mock

from fastapi import HTTPException
from starlette.requests import Request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import capsules


class _DriverHandler(BaseHTTPRequestHandler):
    requests: ClassVar[list[dict[str, object]]] = []
    response_status = 200
    response_body = b'{"ok":true}'
    response_headers: ClassVar[dict[str, str]] = {"Content-Type": "application/json"}

    def log_message(self, *_args):
        pass

    def _handle(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b""
        self.__class__.requests.append(
            {
                "method": self.command,
                "path": self.path,
                "body": body,
                "headers": {key.lower(): value for key, value in self.headers.items()},
            }
        )
        self.send_response(self.__class__.response_status)
        headers = dict(self.__class__.response_headers)
        headers.setdefault("Content-Length", str(len(self.__class__.response_body)))
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        if self.__class__.response_body:
            self.wfile.write(self.__class__.response_body)

    do_GET = _handle  # noqa: N815
    do_POST = _handle  # noqa: N815
    do_DELETE = _handle  # noqa: N815


def _request(path: str, body: bytes = b"", content_type: str = "application/json") -> Request:
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    headers = [(b"content-type", content_type.encode()), (b"content-length", str(len(body)).encode())]
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": headers,
        "client": ("127.0.0.1", 1234),
        "server": ("testserver", 80),
    }
    return Request(scope, receive)


class CapsuleAssistantBridgeTest(unittest.TestCase):
    def setUp(self):
        _DriverHandler.requests = []
        _DriverHandler.response_status = 200
        _DriverHandler.response_body = b'{"ok":true}'
        _DriverHandler.response_headers = {"Content-Type": "application/json"}
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _DriverHandler)
        self.thread = threading.Thread(
            target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True
        )
        self.thread.start()
        self.addCleanup(self._stop_server)

        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        token_file = Path(self.tempdir.name) / "token"
        token_file.write_text("internal-test-bearer\n", encoding="utf-8")
        self.patches = (
            mock.patch.object(capsules, "TOKEN_FILE", str(token_file)),
            mock.patch.object(capsules, "URL", f"http://127.0.0.1:{self.server.server_port}"),
        )
        for patcher in self.patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    def _stop_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_forwards_only_the_fixed_assistant_routes_with_existing_bearer(self):
        capsules.list_assistants()
        capsules.list_installed_assistants("capsule_1")
        capsules.install_assistant("capsule_1", {"assistant": "hello-pulse"})
        capsules.invoke_assistant_operation("capsule_1", "hello-pulse", "hello", {"name": "Captain"})
        capsules.uninstall_assistant("capsule_1", "hello-pulse")

        self.assertEqual(
            [(item["method"], item["path"]) for item in _DriverHandler.requests],
            [
                ("GET", "/v1/assistants"),
                ("GET", "/v1/capsules/capsule_1/assistants"),
                ("POST", "/v1/capsules/capsule_1/assistants"),
                ("POST", "/v1/capsules/capsule_1/assistants/hello-pulse/operations/hello"),
                ("DELETE", "/v1/capsules/capsule_1/assistants/hello-pulse"),
            ],
        )
        self.assertEqual(json.loads(_DriverHandler.requests[2]["body"]), {"assistant": "hello-pulse"})
        self.assertEqual(json.loads(_DriverHandler.requests[3]["body"]), {"name": "Captain"})
        for request in _DriverHandler.requests:
            self.assertEqual(request["headers"]["accept"], "application/json")
            self.assertEqual(request["headers"]["authorization"], "Bearer internal-test-bearer")
        self.assertNotIn("content-type", _DriverHandler.requests[0]["headers"])

    def test_preserves_safe_driver_status_and_body(self):
        _DriverHandler.response_status = 409
        _DriverHandler.response_body = b'{"detail":"assistant already installed"}'

        response = capsules.install_assistant("capsule_1", {"assistant": "hello-pulse"})

        self.assertEqual(
            response,
            capsules.DriverResponse(409, {"detail": "assistant already installed"}),
        )

    def test_rejects_unknown_paths_operations_and_input_before_network_access(self):
        invalid = (
            lambda: capsules.list_installed_assistants("Capsule_1"),
            lambda: capsules.install_assistant("capsule_1", {"assistant": "../hello-pulse"}),
            lambda: capsules.install_assistant("capsule_1", {"assistant": "hello-pulse", "extra": True}),
            lambda: capsules.invoke_assistant_operation(
                "capsule_1", "hello-pulse", "delete-everything", {"name": "Captain"}
            ),
            lambda: capsules.invoke_assistant_operation(
                "capsule_1", "hello-pulse", "hello", {"name": "Captain", "command": "whoami"}
            ),
            lambda: capsules.invoke_assistant_operation(
                "capsule_1", "hello-pulse", "hello", {"name": "x" * 81}
            ),
        )
        for operation in invalid:
            with self.subTest(operation=operation), self.assertRaises(capsules.CapsuleRequestError):
                operation()
        self.assertEqual(_DriverHandler.requests, [])

    def test_invalid_or_oversized_driver_json_fails_closed(self):
        cases = (
            (b'["not-an-object"]', {"Content-Type": "application/json"}),
            (b'{"ok":true}', {"Content-Type": "text/plain"}),
            (
                b"",
                {
                    "Content-Type": "application/json",
                    "Content-Length": str(capsules.MAX_JSON_RESPONSE_BYTES + 1),
                },
            ),
        )
        for body, headers in cases:
            with self.subTest(headers=headers):
                _DriverHandler.response_body = body
                _DriverHandler.response_headers = headers
                self.assertEqual(
                    capsules.list_assistants(),
                    capsules.DriverResponse(502, {"detail": "capsule-driver unavailable"}),
                )

    def test_bridge_has_no_docker_or_process_execution_dependency(self):
        tree = ast.parse((ROOT / "backend" / "capsules.py").read_text(encoding="utf-8"))
        imports = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imports.add(node.module.split(".")[0])
        self.assertTrue({"docker", "subprocess"}.isdisjoint(imports))


class CapsuleAssistantRouteTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tempdir = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.tempdir.cleanup)
        root = Path(cls.tempdir.name)
        with mock.patch.dict(
            os.environ,
            {"SHIMPZ_REPO": str(root), "SHIMPZ_ADMIN_STORE": str(root / "admin.json")},
        ):
            sys.modules.pop("app", None)
            cls.admin_app = importlib.import_module("app")

    def test_exposes_only_session_gated_assistant_routes(self):
        routes = {(route.path, method) for route in self.admin_app.app.routes for method in (route.methods or set())}
        expected = {
            ("/api/assistants", "GET"),
            ("/api/capsules/{cid}/assistants", "GET"),
            ("/api/capsules/{cid}/assistants", "POST"),
            ("/api/capsules/{cid}/assistants/{assistant_id}/operations/{operation}", "POST"),
            ("/api/capsules/{cid}/assistants/{assistant_id}", "DELETE"),
        }
        self.assertTrue(expected.issubset(routes))
        self.assertTrue(all(path not in self.admin_app.OPEN_API for path, _method in expected))

        request = _request("/api/assistants")

        async def should_not_run(_request):
            self.fail("anonymous request reached the Assistant catalog")

        response = asyncio.run(self.admin_app._gate(request, should_not_run))
        self.assertEqual(response.status_code, 401)

    def test_install_route_preserves_conflict_and_forwards_exact_body(self):
        request = _request(
            "/api/capsules/capsule_1/assistants",
            json.dumps({"assistant": "hello-pulse"}).encode(),
        )
        with mock.patch.object(
            self.admin_app.capsules,
            "install_assistant",
            return_value=capsules.DriverResponse(409, {"detail": "already installed"}),
        ) as install:
            response = asyncio.run(self.admin_app.capsule_assistant_install("capsule_1", request))

        self.assertEqual(response.status_code, 409)
        self.assertEqual(json.loads(response.body), {"detail": "already installed"})
        install.assert_called_once_with("capsule_1", {"assistant": "hello-pulse"})

    def test_operation_body_is_bounded_before_driver_call(self):
        request = _request(
            "/api/capsules/capsule_1/assistants/hello-pulse/operations/hello",
            b'{' + b'"name":"' + b"x" * capsules.MAX_JSON_BODY_BYTES + b'"}',
        )
        with mock.patch.object(self.admin_app.capsules, "invoke_assistant_operation") as invoke:
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(
                    self.admin_app.capsule_assistant_operation(
                        "capsule_1", "hello-pulse", "hello", request
                    )
                )
        self.assertEqual(raised.exception.status_code, 413)
        invoke.assert_not_called()


if __name__ == "__main__":
    unittest.main()
