import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ASSISTANT_CONNECTIONS_COPY,
  assistantConnectionsCopy,
} from '../src/lib/assistantConnectionsCopy.js';

const dialogSource = readFileSync(
  new URL('../src/lib/AssistantConnectionsDialog.svelte', import.meta.url),
  'utf8',
);
const drawerSource = readFileSync(
  new URL('../src/lib/AssistantConnectionsDrawer.svelte', import.meta.url),
  'utf8',
);
const pageSource = readFileSync(
  new URL('../src/routes/chat/+page.svelte', import.meta.url),
  'utf8',
);
const LOCALES = ['en', 'pt', 'es', 'zh', 'fr', 'de', 'ja', 'ar'];

test('localizes every Assistant connection surface without partial fallback', () => {
  const baseline = Object.keys(ASSISTANT_CONNECTIONS_COPY.en).sort();
  assert.deepEqual(Object.keys(ASSISTANT_CONNECTIONS_COPY).sort(), [...LOCALES].sort());
  for (const locale of LOCALES) {
    const copy = assistantConnectionsCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), baseline);
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.trim()));
  }
  assert.equal(assistantConnectionsCopy('unsupported'), ASSISTANT_CONNECTIONS_COPY.en);
});

test('explains every requested connection, permission, and Power without collecting values', () => {
  assert.match(dialogSource, /challenge\?\.requirements \?\? \[\] as requirement/);
  assert.match(dialogSource, /\{requirement\.assistant_name\}[\s\S]*\{requirement\.name\}[\s\S]*\{requirement\.summary\}/);
  assert.match(dialogSource, /\{#each requirement\.scopes as scope/);
  assert.match(dialogSource, /\{#each requirement\.powers as power/);
  assert.match(dialogSource, /\{power\.name\}[\s\S]*\{power\.summary\}/);
  assert.match(dialogSource, /onauthorize\?\.\(challenge\.challenge_id\)/);
  assert.doesNotMatch(dialogSource, /<input|<textarea|\{@html|fetch\(|localStorage|sessionStorage/i);
  assert.doesNotMatch(dialogSource, /token|secret|credential|code_verifier|client_id/i);
});

test('shows status-only connections grouped by Assistant in a full-height drawer', () => {
  assert.match(drawerSource, /for \(const connection of connections\)/);
  assert.match(drawerSource, /\{#each groups as assistant \(assistant\.id\)\}/);
  assert.match(drawerSource, /\{#each assistant\.connections as connection \(connection\.id\)\}/);
  assert.match(drawerSource, /accountLabel\(connection\.account\)/);
  assert.match(drawerSource, /connection\.scopes\.join\('\s*·\s*'\)/);
  assert.match(drawerSource, /connect\(pending\.challenge_id\)/);
  assert.match(drawerSource, /await onconnect\?\.\(challengeId\)/);
  assert.match(drawerSource, /ondisconnect\?\.\(connection\)/);
  assert.match(drawerSource, /height: 100vh; height: 100dvh;[\s\S]*max-height: 100dvh;/);
  assert.doesNotMatch(drawerSource, /<input|<textarea|\{@html|fetch\(/i);
  assert.doesNotMatch(drawerSource, /token|secret|credential|code_verifier|client_id/i);
});

test('pauses chat for connection challenges and leaves authorization to the controller', () => {
  assert.match(
    pageSource,
    /incoming\.type === 'connections-required'[\s\S]*acceptConnectionChallenge\(incoming\)/,
  );
  assert.match(
    pageSource,
    /function acceptConnectionChallenge\(incoming\)[\s\S]*new Set\(\$teamContext\.selectedAssistantIds\)[\s\S]*busy = true;/,
  );
  assert.match(
    pageSource,
    /authorizeAssistantConnection\(fetch, teamId, challengeId\)[\s\S]*location\.assign\(authorization\.authorization_url\)/,
  );
  assert.doesNotMatch(pageSource, /window\.open\(authorization|target=['"]_blank/i);
  assert.match(pageSource, /disconnectAssistantConnection\(fetch, teamId, connection\.assistant_id, connection\.id\)/);
  assert.match(pageSource, /listAssistantConnections\(fetch, teamId\)/);
});

test('clears connection state on Team and socket boundaries and mounts both closed surfaces', () => {
  assert.match(pageSource, /function closeSocket\(\)[\s\S]*connectionChallenge = undefined;[\s\S]*connectionsReady = false;/);
  assert.match(pageSource, /function activateTeam\(nextTeamId\)[\s\S]*connections = \[\];[\s\S]*connectionsReady = false;/);
  assert.match(pageSource, /class:drawer-open=\{helpOpen \|\| secretsOpen \|\| connectionsOpen\}/);
  assert.match(pageSource, /aria-controls="assistant-connections-drawer"/);
  assert.match(pageSource, /<AssistantConnectionsDrawer[\s\S]*pending=\{connectionChallenge\}[\s\S]*ondisconnect=\{disconnectConnection\}/);
  assert.match(pageSource, /<AssistantConnectionsDialog[\s\S]*challenge=\{connectionChallenge\}[\s\S]*onauthorize=\{authorizeConnection\}/);
});
