import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INSTALL_ACK_TYPE,
  INSTALL_INTENT,
  STORE_CONTEXT_TYPE,
  STORE_FRAME_MAX_HEIGHT,
  STORE_FRAME_MIN_HEIGHT,
  STORE_FRAME_TYPE,
  STORE_ORIGIN,
  acknowledgeStoreFrame,
  acknowledgeStoreInstallIntent,
  acceptsStoreInstallIntent,
  storeFrameHeight,
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

test('accepts only exact bounded integer Store frame measurements', () => {
  const iframeWindow = {};
  const exact = {
    origin: STORE_ORIGIN,
    source: iframeWindow,
    data: { type: STORE_FRAME_TYPE, version: 1, height: 640 },
  };

  assert.equal(storeFrameHeight(exact, iframeWindow), 640);
  assert.equal(storeFrameHeight({ ...exact, data: { ...exact.data, height: STORE_FRAME_MIN_HEIGHT } }, iframeWindow), 320);
  assert.equal(storeFrameHeight({ ...exact, data: { ...exact.data, height: STORE_FRAME_MAX_HEIGHT } }, iframeWindow), 5000);

  const cases = [
    { ...exact, origin: 'https://www.shimpz.com' },
    { ...exact, source: {} },
    { ...exact, data: { ...exact.data, type: 'shimpz:assistant-store-ready' } },
    { ...exact, data: { ...exact.data, version: '1' } },
    { ...exact, data: { ...exact.data, height: STORE_FRAME_MIN_HEIGHT - 1 } },
    { ...exact, data: { ...exact.data, height: STORE_FRAME_MAX_HEIGHT + 1 } },
    { ...exact, data: { ...exact.data, height: 640.5 } },
    { ...exact, data: { ...exact.data, height: '640' } },
    { ...exact, data: { ...exact.data, capsule: 'private_capsule' } },
    { ...exact, data: null },
    { ...exact, data: [STORE_FRAME_TYPE, 1, 640] },
  ];

  for (const candidate of cases) assert.equal(storeFrameHeight(candidate, iframeWindow), null);
  assert.equal(storeFrameHeight(exact, null), null);
});

test('acknowledges each valid Store frame without exposing local context', () => {
  const acknowledgements = [];
  const iframeWindow = {
    postMessage(message, targetOrigin) { acknowledgements.push({ message, targetOrigin }); },
  };
  const event = {
    origin: STORE_ORIGIN,
    source: iframeWindow,
    data: { type: STORE_FRAME_TYPE, version: 1, height: 712 },
  };

  assert.equal(acknowledgeStoreFrame(event, iframeWindow), 712);
  assert.deepEqual(acknowledgements, [{
    message: { type: STORE_CONTEXT_TYPE, version: 1 },
    targetOrigin: STORE_ORIGIN,
  }]);
  assert.deepEqual(Object.keys(acknowledgements[0].message).sort(), ['type', 'version']);

  assert.equal(
    acknowledgeStoreFrame({ ...event, data: { ...event.data, token: 'secret' } }, iframeWindow),
    null,
  );
  assert.equal(acknowledgements.length, 1);
});
