import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INSTALL_ACK_TYPE,
  INSTALL_INTENT,
  STORE_ORIGIN,
  acknowledgeStoreInstallIntent,
  acceptsStoreInstallIntent,
} from '../src/lib/assistantIntent.js';

test('accepts only the exact Hello Pulse intent from the embedded Store window', () => {
  const iframeWindow = {};
  const event = { origin: STORE_ORIGIN, source: iframeWindow, data: { ...INSTALL_INTENT } };

  assert.equal(acceptsStoreInstallIntent(event, iframeWindow), true);
});

test('rejects every untrusted origin, source, type, version, id, and extra field', () => {
  const iframeWindow = {};
  const exact = { origin: STORE_ORIGIN, source: iframeWindow, data: { ...INSTALL_INTENT } };
  const cases = [
    { ...exact, origin: 'https://www.shimpz.com' },
    { ...exact, origin: 'http://shimpz.com' },
    { ...exact, source: {} },
    { ...exact, data: { ...INSTALL_INTENT, type: 'shimpz:assistant-uninstall' } },
    { ...exact, data: { ...INSTALL_INTENT, version: '1' } },
    { ...exact, data: { ...INSTALL_INTENT, version: 2 } },
    { ...exact, data: { ...INSTALL_INTENT, assistant: 'salesnator' } },
    { ...exact, data: { ...INSTALL_INTENT, capsule: 'capsule_1' } },
    { ...exact, data: null },
    { ...exact, data: ['shimpz:assistant-install', 1, 'hello-pulse'] },
  ];

  for (const candidate of cases) assert.equal(acceptsStoreInstallIntent(candidate, iframeWindow), false);
  assert.equal(acceptsStoreInstallIntent(exact, null), false);
});

test('acknowledges an accepted intent without exposing any local state', () => {
  const acknowledgements = [];
  const iframeWindow = {
    postMessage(message, targetOrigin) { acknowledgements.push({ message, targetOrigin }); },
  };
  const event = { origin: STORE_ORIGIN, source: iframeWindow, data: { ...INSTALL_INTENT } };

  assert.equal(acknowledgeStoreInstallIntent(event, iframeWindow), true);
  assert.deepEqual(acknowledgements, [{
    message: {
      type: INSTALL_ACK_TYPE,
      version: 1,
      assistant: 'hello-pulse',
      accepted: true,
    },
    targetOrigin: STORE_ORIGIN,
  }]);
  assert.deepEqual(Object.keys(acknowledgements[0].message).sort(), [
    'accepted',
    'assistant',
    'type',
    'version',
  ]);
});

test('never acknowledges a rejected Store message', () => {
  const acknowledgements = [];
  const iframeWindow = {
    postMessage(message, targetOrigin) { acknowledgements.push({ message, targetOrigin }); },
  };
  const event = {
    origin: 'https://lookalike.invalid',
    source: iframeWindow,
    data: { ...INSTALL_INTENT },
  };

  assert.equal(acknowledgeStoreInstallIntent(event, iframeWindow), false);
  assert.deepEqual(acknowledgements, []);
});
