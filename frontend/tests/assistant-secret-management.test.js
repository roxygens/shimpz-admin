import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ASSISTANT_SECRET_MANAGEMENT_COPY,
  assistantSecretManagementCopy,
} from '../src/lib/assistantSecretManagementCopy.js';

const dialogSource = readFileSync(
  new URL('../src/lib/AssistantSecretRotationDialog.svelte', import.meta.url),
  'utf8',
);
const drawerSource = readFileSync(
  new URL('../src/lib/AssistantSecretsDrawer.svelte', import.meta.url),
  'utf8',
);
const pageSource = readFileSync(
  new URL('../src/routes/chat/+page.svelte', import.meta.url),
  'utf8',
);
const LOCALES = ['en', 'pt', 'es', 'zh', 'fr', 'de', 'ja', 'ar'];

test('localizes secret rotation and remembered approval controls', () => {
  const baseline = Object.keys(ASSISTANT_SECRET_MANAGEMENT_COPY.en).sort();
  assert.deepEqual(Object.keys(ASSISTANT_SECRET_MANAGEMENT_COPY).sort(), [...LOCALES].sort());
  for (const locale of LOCALES) {
    const copy = assistantSecretManagementCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), baseline);
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.trim()));
  }
});

test('keeps replacement drafts write-only and clears every terminal path', () => {
  assert.match(dialogSource, /let values = \$state\(\{\}\);/);
  assert.match(dialogSource, /function clearValues\(\) \{ values = \{\}; submitError = ''; \}/);
  assert.match(dialogSource, /type="password"/);
  assert.match(dialogSource, /autocomplete="off"[\s\S]*autocapitalize="none"[\s\S]*spellcheck="false"/);
  assert.match(dialogSource, /await onsubmit\?\.\(assistant\.id, outgoing\);\s*clearValues\(\);/);
  assert.match(dialogSource, /catch \{\s*clearValues\(\);\s*submitError = management\.failed;/);
  assert.match(dialogSource, /if \(!open\) clearValues\(\)/);
  assert.doesNotMatch(dialogSource, /localStorage|sessionStorage|indexedDB|\{@html|type="text"/i);
});

test('offers per-Assistant rotation and one Team-wide remembered approval reset', () => {
  assert.match(drawerSource, /class="rotate"[\s\S]*onrotate\?\.\(assistant\)/);
  assert.match(drawerSource, /approvalCount === 0[\s\S]*management\.noApprovals/);
  assert.match(drawerSource, /disabled=\{approvalsLoading\}[\s\S]*onrevoke\?\.\(\)/);
  assert.match(pageSource, /listRememberedApprovals\(fetch, teamId\)/);
  assert.match(pageSource, /replaceAssistantSecrets\(fetch, teamId, assistantId, values\)/);
  assert.match(pageSource, /revokeRememberedApprovals\(fetch, teamId\)/);
  assert.match(pageSource, /rememberedApprovals = \[\];\s*approvalsReady = true;/);
});

test('mounts rotation closed and never stores a submitted secret in page state', () => {
  assert.match(pageSource, /<AssistantSecretRotationDialog[\s\S]*onsubmit=\{rotateSecrets\}/);
  assert.match(pageSource, /secretInventory = inventory\.assistants;\s*secretInventoryReady = true;\s*closeRotation\(\);/);
  assert.doesNotMatch(pageSource, /secretValues|credentialValues|localStorage|sessionStorage|indexedDB/);
});
