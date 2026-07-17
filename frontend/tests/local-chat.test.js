import assert from 'node:assert/strict';
import test from 'node:test';

import { listCapsuleFiles, sendChat, stopChat } from '../src/lib/localChat.js';

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

test('chat sends only assistant, message, and files', async () => {
  const calls = [];
  const result = await sendChat(
    async (url, options) => {
      calls.push({ url, options });
      return response(200, { assistant: 'hello-pulse', reply: 'Hello!', power: 'hello' });
    },
    'capsule_1',
    { assistant: 'hello-pulse', message: '  Hi  ', files: ['a'.repeat(32)] },
  );
  assert.deepEqual(result, { assistant: 'hello-pulse', reply: 'Hello!', power: 'hello' });
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    assistant: 'hello-pulse', message: 'Hi', files: ['a'.repeat(32)],
  });
  assert.doesNotMatch(calls[0].options.body, /provider|model|api_key|credential/);
});

test('chat rejects credential or provider fields before fetch', async () => {
  let called = false;
  for (const extra of [{ provider: 'openai' }, { api_key: 'must-not-cross' }, { model: 'gpt-5.5' }]) {
    await assert.rejects(
      sendChat(
        async () => { called = true; },
        'capsule_1',
        { assistant: 'hello-pulse', message: 'Hi', files: [], ...extra },
      ),
      /only assistant, message, and files/,
    );
  }
  assert.equal(called, false);
});

test('chat surfaces a real missing-runtime 503 and does not synthesize success', async () => {
  await assert.rejects(
    sendChat(
      async () => response(503, { detail: 'local chat runtime is unavailable; update this Shimpz Space' }),
      'capsule_1',
      { assistant: 'hello-pulse', message: 'Hi', files: [] },
    ),
    (error) => error.status === 503 && /update this Shimpz Space/.test(error.message),
  );
});

test('lists bounded file metadata and calls the fixed stop route', async () => {
  const file = { id: 'b'.repeat(32), name: 'brief.txt', size: 42 };
  assert.deepEqual(
    await listCapsuleFiles(async () => response(200, { files: [file] }), 'capsule_1'),
    [file],
  );
  const stopped = await stopChat(
    async (url, options) => {
      assert.equal(url, '/api/capsules/capsule_1/chat/stop');
      assert.equal(options.method, 'POST');
      return response(200, { capsule: 'capsule_1', stopped: true });
    },
    'capsule_1',
  );
  assert.equal(stopped, true);
});
