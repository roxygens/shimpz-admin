import assert from 'node:assert/strict';
import test from 'node:test';

import { messages } from '../src/lib/messages.js';

test('the Admin copy exposes no global Telegram setup', () => {
  const renderedCopy = JSON.stringify(messages).toLowerCase();

  assert.equal(renderedCopy.includes('telegram'), false);
  assert.equal(renderedCopy.includes('telegram_bot_token'), false);
  assert.equal(renderedCopy.includes('telegram_allowed_users'), false);
});
