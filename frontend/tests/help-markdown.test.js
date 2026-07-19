import assert from 'node:assert/strict';
import test from 'node:test';

import { parseHelpInline, parseHelpMarkdown } from '../src/lib/helpMarkdown.js';

test('parses the small supported Help Markdown surface into a closed AST', () => {
  const blocks = parseHelpMarkdown(`# Weather Guide

Ask for **current weather** or *a forecast* with \`days\`.

- Find a place
- Read current conditions

1. Ask for Lisbon
2. Choose a result

\`\`\`
What is the weather in Lisbon?
\`\`\`

[Open the weather provider](https://open-meteo.com/)`);

  assert.deepEqual(blocks.map((block) => block.type), [
    'heading', 'paragraph', 'list', 'list', 'code', 'paragraph',
  ]);
  assert.equal(blocks[0].level, 1);
  assert.deepEqual(blocks[1].inlines.map((token) => token.type), [
    'text', 'strong', 'text', 'emphasis', 'text', 'code', 'text',
  ]);
  assert.equal(blocks[2].ordered, false);
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[4].text, 'What is the weather in Lisbon?');
  assert.equal(blocks[5].inlines[0].href, 'https://open-meteo.com/');
});

test('keeps raw HTML inert text and refuses executable or credential-bearing links', () => {
  const tokens = parseHelpInline(
    '<img src=x onerror=alert(1)> [run](javascript:alert(1)) '
      + '[data](data:text/html,<script>alert(1)</script>) '
      + '[credentials](https://user:password@example.com/) [safe](https://example.com/docs)',
  );

  assert.equal(tokens.some((token) => token.type === 'link' && token.text !== 'safe'), false);
  assert.deepEqual(
    tokens.filter((token) => token.type === 'link'),
    [{ type: 'link', text: 'safe', href: 'https://example.com/docs' }],
  );
  assert.match(tokens.map((token) => token.text).join(''), /<img src=x onerror=alert\(1\)>/);
});

test('does not expose any HTML node or attribute channel in its output model', () => {
  const blocks = parseHelpMarkdown('# <svg onload=alert(1)>\n\n<script>alert(1)</script>');
  const encoded = JSON.stringify(blocks);

  assert.doesNotMatch(encoded, /"(?:html|attributes?|style|event)"\s*:/i);
  assert.match(encoded, /<svg onload=alert\(1\)>/);
  assert.match(encoded, /<script>alert\(1\)<\/script>/);
});
