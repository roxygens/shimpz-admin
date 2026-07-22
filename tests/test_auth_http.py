"""HTTP lifecycle contract for the local Admin authentication boundary."""

from __future__ import annotations

import http.client
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
GOOD_PASSWORD = " ".join(("correct", "horse", "battery", "staple"))

sys.path.insert(0, str(BACKEND))
import auth


def _free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def _request(
    port: int,
    method: str,
    path: str,
    body: dict[str, object] | None = None,
    *,
    session: str | None = None,
    timeout: float = 10,
) -> tuple[int, object, str]:
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=timeout)
    headers = {"Content-Type": "application/json"}
    if session is not None:
        headers["Cookie"] = f"shimpz_admin={session}"
    connection.request(method, path, json.dumps(body) if body is not None else None, headers)
    response = connection.getresponse()
    raw = response.read().decode("utf-8", errors="replace")
    set_cookie = response.getheader("Set-Cookie") or ""
    connection.close()
    try:
        payload: object = json.loads(raw)
    except json.JSONDecodeError:
        payload = raw
    return response.status, payload, set_cookie


def _session_cookie(set_cookie: str) -> str | None:
    match = re.search(r"shimpz_admin=([^;]+)", set_cookie)
    return match.group(1) if match else None


class AuthHTTPTests(unittest.TestCase):
    def test_real_http_lifecycle_persists_only_hardened_credentials(self) -> None:
        port = _free_port()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            store = root / "admin.json"
            process = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "app:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(port),
                    "--log-level",
                    "warning",
                ],
                cwd=BACKEND,
                env={
                    **os.environ,
                    "SHIMPZ_REPO": str(root),
                    "SHIMPZ_ADMIN_STORE": str(store),
                    "SHIMPZ_TEAM_CREDENTIALS_ENABLED": "0",
                },
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            try:
                self._wait_until_ready(process, port)
                self._exercise_lifecycle(port, store)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)
                if process.stdout is not None:
                    process.stdout.close()

    def _wait_until_ready(self, process: subprocess.Popen[str], port: int) -> None:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if process.poll() is not None:
                output = process.stdout.read() if process.stdout else ""
                self.fail(f"Admin HTTP server exited during startup:\n{output[-2000:]}")
            try:
                if _request(port, "GET", "/api/session", timeout=1)[0] == 200:
                    return
            except OSError:
                time.sleep(0.05)
        self.fail("Admin HTTP server did not become ready within 30 seconds")

    def _exercise_lifecycle(self, port: int, store: Path) -> None:
        status, payload, _ = _request(port, "GET", "/api/session")
        self.assertEqual(status, 200)
        self.assertEqual(
            payload,
            {"authenticated": False, "initialized": False, "features": {"teamCredentials": False}},
        )
        self.assertEqual(_request(port, "GET", "/api/state")[0], 401)
        self.assertEqual(_request(port, "POST", "/api/admin/setup", {"password": "short"})[0], 400)

        status, payload, set_cookie = _request(
            port,
            "POST",
            "/api/admin/setup",
            {"password": GOOD_PASSWORD},
        )
        session = _session_cookie(set_cookie)
        self.assertEqual((status, payload), (200, {"ok": True}))
        self.assertIsNotNone(session)
        self.assertEqual(_request(port, "GET", "/api/state", session=session)[0], 200)

        self.assertEqual(store.stat().st_mode & 0o777, 0o600)
        disk = store.read_text(encoding="utf-8")
        self.assertNotIn(GOOD_PASSWORD, disk)
        record = json.loads(disk)
        self.assertTrue(record["password_hash"])
        self.assertTrue(record["salt"])
        self.assertTrue(record["session_secret"])

        self.assertEqual(
            _request(port, "POST", "/api/admin/setup", {"password": "another good password"})[0],
            409,
        )
        logout_status, _, logout_cookie = _request(port, "POST", "/api/logout")
        self.assertEqual(logout_status, 200)
        self.assertRegex(logout_cookie, r"shimpz_admin=.*(?:Max-Age=0|01 Jan 1970)")

        self.assertEqual(_request(port, "POST", "/api/login", {"password": "definitely wrong"})[0], 401)
        login_status, login_payload, login_cookie = _request(
            port,
            "POST",
            "/api/login",
            {"password": GOOD_PASSWORD},
        )
        fresh_session = _session_cookie(login_cookie)
        self.assertEqual((login_status, login_payload), (200, {"ok": True}))
        self.assertIsNotNone(fresh_session)
        self.assertEqual(_request(port, "GET", "/api/state", session=fresh_session)[0], 200)

        self.assertEqual(_request(port, "GET", "/api/state", session="garbage-not-a-token")[0], 401)
        expired = auth.issue_session(record["session_secret"], ttl=-10)
        self.assertEqual(_request(port, "GET", "/api/state", session=expired)[0], 401)
        foreign = auth.issue_session(auth.new_secret())
        self.assertEqual(_request(port, "GET", "/api/state", session=foreign)[0], 401)
        self.assertEqual(_request(port, "GET", "/")[0], 200)


if __name__ == "__main__":
    unittest.main()
