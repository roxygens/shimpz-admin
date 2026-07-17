<script>
  import { onMount } from 'svelte';
  import AdminShell from '$lib/AdminShell.svelte';
  import LocaleMenu from '$lib/LocaleMenu.svelte';
  import { locale, t } from '$lib/i18n.js';
  import { listInstalledAssistants, safeApiError } from '$lib/localApi.js';
  import { listCapsuleFiles, sendChat, stopChat } from '$lib/localChat.js';

  const CID_RE = /^[a-z0-9_]{1,40}$/;
  const COPY = {
    en: {
      kicker: 'Capsule // Assistant chat', title: 'Talk through declared Powers.',
      lead: 'The model can use only the installed Assistant’s declared Powers. Model keys stay in the Admin backend.',
      capsule: 'Capsule', assistant: 'Assistant', files: 'Files', noFiles: 'No stored files in this Capsule.',
      placeholder: 'Ask the Assistant to use one of its declared Powers…', send: 'Send', sending: 'Thinking…',
      stop: 'Stop', stopped: 'The active turn was stopped.', power: 'Power used', emptyCapsules: 'Create a running Capsule first.',
      emptyAssistants: 'Install an Assistant in this Capsule before chatting.', openCapsules: 'Open Capsules', openStore: 'Open Assistants',
      loadFailed: 'Local chat data is unavailable.', needAuth: 'Sign in to use local chat.', signIn: 'Open sign-in',
    },
    pt: {
      kicker: 'Cápsula // Chat do Assistant', title: 'Converse através dos Powers declarados.',
      lead: 'O modelo usa apenas os Powers declarados do Assistant instalado. As chaves ficam no backend do Admin.',
      capsule: 'Cápsula', assistant: 'Assistant', files: 'Arquivos', noFiles: 'Nenhum arquivo armazenado nesta Cápsula.',
      placeholder: 'Peça ao Assistant para usar um dos Powers declarados…', send: 'Enviar', sending: 'Pensando…',
      stop: 'Parar', stopped: 'O turno ativo foi interrompido.', power: 'Power usado', emptyCapsules: 'Crie primeiro uma Cápsula em execução.',
      emptyAssistants: 'Instale um Assistant nesta Cápsula antes de conversar.', openCapsules: 'Abrir Cápsulas', openStore: 'Abrir Assistants',
      loadFailed: 'Os dados do chat local estão indisponíveis.', needAuth: 'Entre para usar o chat local.', signIn: 'Abrir login',
    },
  };

  let phase = $state('checking');
  let capsules = $state([]);
  let capsuleId = $state('');
  let assistants = $state([]);
  let assistant = $state('');
  let files = $state([]);
  let selectedFiles = $state([]);
  let draft = $state('');
  let turns = $state([]);
  let busy = $state(false);
  let stopping = $state(false);
  let error = $state('');

  let copy = $derived(COPY[$locale] ?? COPY.en);
  let runningCapsules = $derived(capsules.filter((entry) => entry.status === 'running'));

  function normalizeCapsules(document) {
    if (!Array.isArray(document?.capsules)) return [];
    return document.capsules
      .filter((entry) => entry && CID_RE.test(entry.id) && typeof entry.status === 'string')
      .map((entry) => ({
        id: entry.id,
        name: typeof entry.name === 'string' && entry.name ? entry.name : entry.id,
        status: entry.status,
      }));
  }

  async function loadCapsuleData() {
    assistants = [];
    files = [];
    selectedFiles = [];
    assistant = '';
    turns = [];
    error = '';
    if (!capsuleId) return;
    try {
      [assistants, files] = await Promise.all([
        listInstalledAssistants(fetch, capsuleId),
        listCapsuleFiles(fetch, capsuleId),
      ]);
      assistant = assistants.find((entry) => entry.status === 'running')?.assistant ?? assistants[0]?.assistant ?? '';
    } catch (reason) {
      error = reason instanceof Error ? reason.message : copy.loadFailed;
    }
  }

  async function load() {
    phase = 'checking';
    error = '';
    try {
      const sessionResponse = await fetch('/api/session', { cache: 'no-store' });
      if (!sessionResponse.ok || !(await sessionResponse.json()).authenticated) {
        phase = 'needauth';
        return;
      }
      const response = await fetch('/api/capsules', {
        cache: 'no-store', headers: { Accept: 'application/json' },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(safeApiError(body, copy.loadFailed));
      capsules = normalizeCapsules(body);
      const requested = new URL(location.href).searchParams.get('capsule') ?? '';
      capsuleId = runningCapsules.some((entry) => entry.id === requested)
        ? requested
        : (runningCapsules[0]?.id ?? '');
      phase = 'ready';
      await loadCapsuleData();
    } catch (reason) {
      error = reason instanceof Error ? reason.message : copy.loadFailed;
      phase = 'ready';
    }
  }

  async function selectCapsule(event) {
    capsuleId = event.currentTarget.value;
    const url = new URL(location.href);
    url.searchParams.set('capsule', capsuleId);
    history.replaceState(history.state, '', url);
    await loadCapsuleData();
  }

  function toggleFile(fileId) {
    selectedFiles = selectedFiles.includes(fileId)
      ? selectedFiles.filter((value) => value !== fileId)
      : selectedFiles.length < 8 ? [...selectedFiles, fileId] : selectedFiles;
  }

  async function send(event) {
    event.preventDefault();
    if (busy || !capsuleId || !assistant || !draft.trim()) return;
    const message = draft.trim();
    busy = true;
    error = '';
    turns = [...turns, { role: 'user', text: message }];
    try {
      const response = await sendChat(fetch, capsuleId, { assistant, message, files: selectedFiles });
      turns = [...turns, { role: 'assistant', text: response.reply, power: response.power }];
      draft = '';
    } catch (reason) {
      error = reason instanceof Error ? reason.message : copy.loadFailed;
    } finally {
      busy = false;
    }
  }

  async function stop() {
    if (!busy || stopping || !capsuleId) return;
    stopping = true;
    error = '';
    try {
      await stopChat(fetch, capsuleId);
      error = copy.stopped;
    } catch (reason) {
      error = reason instanceof Error ? reason.message : copy.loadFailed;
    } finally {
      stopping = false;
    }
  }

  async function logout() {
    try { await fetch('/api/logout', { method: 'POST' }); } finally { location.assign('/'); }
  }

  onMount(load);
</script>

<svelte:head><title>Chat — Shimpz Admin</title></svelte:head>

<AdminShell active="chat" authenticated={phase === 'ready'} actions={shellActions}>
  {#if phase === 'checking'}
    <p class="center" aria-live="polite">Loading local chat…</p>
  {:else if phase === 'needauth'}
    <section class="gate"><h1>{copy.needAuth}</h1><a href="/">{copy.signIn} →</a></section>
  {:else}
    <section class="heading">
      <p>{copy.kicker}</p><h1>{copy.title}</h1><span>{copy.lead}</span>
    </section>

    {#if runningCapsules.length}
      <div class="chat-shell">
        <aside>
          <label><span>{copy.capsule}</span><select value={capsuleId} onchange={selectCapsule} disabled={busy}>
            {#each runningCapsules as capsule (capsule.id)}<option value={capsule.id}>{capsule.name}</option>{/each}
          </select></label>
          {#if assistants.length}
            <label><span>{copy.assistant}</span><select bind:value={assistant} disabled={busy}>
              {#each assistants as entry (entry.assistant)}<option value={entry.assistant}>{entry.assistant}</option>{/each}
            </select></label>
          {:else}
            <div class="empty"><p>{copy.emptyAssistants}</p><a href={`/assistants/?capsule=${capsuleId}`}>{copy.openStore} →</a></div>
          {/if}
          <section class="files"><h2>{copy.files} <small>{selectedFiles.length}/8</small></h2>
            {#if files.length}<ul>{#each files as file (file.id)}<li><label>
              <input type="checkbox" checked={selectedFiles.includes(file.id)} disabled={busy} onchange={() => toggleFile(file.id)} />
              <span>{file.name}<small>{Math.ceil(file.size / 1024)} KB</small></span>
            </label></li>{/each}</ul>{:else}<p>{copy.noFiles}</p>{/if}
          </section>
        </aside>

        <section class="conversation" aria-live="polite">
          <div class="turns">
            {#if turns.length}{#each turns as turn}<article class={turn.role}>
              <small>{turn.role === 'user' ? 'You' : turn.power ? `${copy.power}: ${turn.power}` : assistant}</small>
              <p>{turn.text}</p>
            </article>{/each}{:else}<p class="conversation-empty">{copy.placeholder}</p>{/if}
          </div>
          {#if error}<p class="error" role="alert">{error}</p>{/if}
          <form onsubmit={send}>
            <textarea bind:value={draft} maxlength="16000" rows="3" placeholder={copy.placeholder} disabled={busy || !assistant}></textarea>
            <div>
              {#if busy}<button class="stop" type="button" onclick={stop} disabled={stopping}>{copy.stop}</button>{/if}
              <button class="send" type="submit" disabled={busy || !assistant || !draft.trim()}>{busy ? copy.sending : copy.send}</button>
            </div>
          </form>
        </section>
      </div>
    {:else}
      <section class="gate"><h2>{copy.emptyCapsules}</h2><a href="/capsules/">{copy.openCapsules} →</a></section>
    {/if}
  {/if}
</AdminShell>

{#snippet shellActions()}
  <LocaleMenu compact={phase !== 'ready'} />
  {#if phase === 'ready'}<button class="logout" type="button" onclick={logout}>{$t('auth.logout')} ↪</button>{/if}
{/snippet}

<style>
  .heading { margin-bottom: 1.5rem; }
  .heading > p { margin: 0 0 0.7rem; color: var(--accent); font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; }
  h1 { max-width: 13ch; margin: 0; font-size: clamp(2.3rem, 6vw, 4.6rem); line-height: 0.98; letter-spacing: -0.07em; }
  .heading > span { display: block; max-width: 65ch; margin-top: 0.9rem; color: var(--text-dim); line-height: 1.6; }
  .chat-shell { display: grid; min-height: 34rem; grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr); border: 1px solid var(--border-strong); background: var(--surface-1); }
  aside { padding: 1rem; border-right: 1px solid var(--border); background: rgba(0, 0, 0, 0.2); }
  aside > label { display: grid; gap: 0.35rem; margin-bottom: 0.8rem; }
  label > span, .files h2 { color: var(--text-faint); font-family: var(--font-mono); font-size: 0.56rem; letter-spacing: 0.09em; text-transform: uppercase; }
  select, textarea { width: 100%; border: 1px solid var(--border-strong); background: #050708; color: var(--text); font-family: var(--font-mono); }
  select { min-height: 2.5rem; padding: 0 0.65rem; }
  textarea { resize: vertical; padding: 0.75rem; line-height: 1.5; }
  .files { margin-top: 1.2rem; border-top: 1px solid var(--border); padding-top: 1rem; }
  .files h2 { display: flex; justify-content: space-between; margin: 0 0 0.7rem; }
  .files ul { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
  .files li label { display: flex; align-items: start; gap: 0.45rem; color: var(--text-dim); font-size: 0.7rem; }
  .files li span { display: grid; overflow-wrap: anywhere; }
  .files li small, .files > p { color: var(--text-faint); font-size: 0.58rem; }
  .conversation { display: grid; min-width: 0; grid-template-rows: 1fr auto auto; }
  .turns { display: flex; max-height: 32rem; flex-direction: column; gap: 0.8rem; overflow: auto; padding: 1.2rem; }
  article { max-width: min(80%, 46rem); padding: 0.8rem 1rem; background: #080b0d; box-shadow: inset 0 0 0 1px var(--border); }
  article.user { align-self: flex-end; border-right: 2px solid var(--accent); }
  article.assistant { align-self: flex-start; border-left: 2px solid var(--accent-alt); }
  article small { color: var(--accent); font-family: var(--font-mono); font-size: 0.55rem; text-transform: uppercase; }
  article p { margin: 0.35rem 0 0; white-space: pre-wrap; line-height: 1.55; }
  .conversation-empty { margin: auto; color: var(--text-faint); text-align: center; }
  .conversation form { padding: 0.9rem; border-top: 1px solid var(--border); }
  .conversation form > div { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.55rem; }
  button, .gate a, .empty a { min-height: 2.4rem; border: 1px solid var(--border-strong); padding: 0 0.8rem; background: transparent; color: var(--accent); cursor: pointer; font-family: var(--font-mono); font-size: 0.6rem; font-weight: 700; text-decoration: none; text-transform: uppercase; }
  button.send { border: 0; background: var(--accent); color: #001013; }
  button.stop { border-color: var(--danger); color: var(--danger); }
  button:disabled { cursor: not-allowed; opacity: 0.4; }
  .error { margin: 0; border-left: 2px solid var(--danger); padding: 0.65rem 0.9rem; color: var(--danger); font-size: 0.72rem; }
  .empty p, .files > p { color: var(--text-faint); font-size: 0.68rem; line-height: 1.5; }
  .empty a, .gate a { display: inline-flex; align-items: center; }
  .gate, .center { display: grid; min-height: 25rem; place-items: center; gap: 1rem; text-align: center; }
  .logout { min-height: 2.75rem; }
  @media (max-width: 760px) { .chat-shell { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid var(--border); } .turns { min-height: 20rem; } article { max-width: 92%; } }
</style>
