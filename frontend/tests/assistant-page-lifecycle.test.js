import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/routes/assistants/+page.svelte', import.meta.url),
  'utf8',
);

test('holds Store admission through modal close and intercepts Escape while busy', () => {
  assert.match(source, /storeActionLatch\.acquire\('install'\)/);
  assert.match(source, /storeActionLatch\.acquire\('uninstall'\)/);
  assert.match(source, /function closeInstallDialog\(\) \{\s+if \(busy\) return;/);
  assert.match(source, /function cancelInstallDialog\(event\) \{\s+event\.preventDefault\(\);\s+if \(busy\) return;/);
  assert.match(source, /<dialog[^>]+oncancel=\{cancelInstallDialog\}/);
  assert.match(source, /finally \{\s+storeActionLatch\.release\('uninstall'\);/);
});

test('pins Store protocol while preserving the independent reload counter', () => {
  assert.match(
    source,
    /\/embed\?store-protocol=\$\{STORE_LIFECYCLE_PROTOCOL_VERSION\}&admin-frame=\$\{frameReload\}/,
  );
});
