import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/routes/chat/+page.svelte', import.meta.url), 'utf8');

test('renders the selected Team Assistant inventory before Files with safe Store links', () => {
  const assistants = source.indexOf('<section class="assistants">');
  const files = source.indexOf('<section class="files">');

  assert.ok(assistants > 0 && files > assistants);
  assert.match(source, /listInstalledAssistants\(fetch, capsuleId\)/);
  assert.match(source, /<AssistantIcon assistant=\{assistant\.assistant\} \/>/);
  assert.match(source, /href=\{assistant\.href\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
});

test('keeps friendly i18n and sanitized technical diagnostics separate', () => {
  assert.doesNotMatch(source, /error\s*=\s*terminal\.detail/);
  assert.match(source, /friendlyChatError\(terminal\.status\)/);
  assert.match(source, /`HTTP \$\{terminal\.status\} · \$\{terminal\.detail\}`/);
  assert.match(source, /<div class="error" role="alert">/);
  assert.match(source, /\{copy\.technicalDetail\}: \{errorDetail\}/);
  assert.doesNotMatch(source, /\{@html[^}]*?(?:error|detail)/i);
});
