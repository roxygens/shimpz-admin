import assert from 'node:assert/strict';
import test from 'node:test';

import { messages } from '../src/lib/messages.js';

const expectedLocales = ['en', 'pt', 'es', 'zh', 'fr', 'de', 'ja', 'ar'];

function leafPaths(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return leafPaths(child, path);
    }
    return [path];
  });
}

test('every Admin locale implements the complete English message contract', () => {
  assert.deepEqual(Object.keys(messages), expectedLocales);
  const englishPaths = leafPaths(messages.en).sort();

  for (const locale of expectedLocales) {
    assert.deepEqual(leafPaths(messages[locale]).sort(), englishPaths, locale);
  }
});
