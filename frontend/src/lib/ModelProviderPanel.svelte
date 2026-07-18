<script>
  import { onMount } from 'svelte';
  import { locale } from '$lib/i18n.js';
  import {
    listModelProviders,
    loadInference,
    removeModelKey,
    saveModelSetup,
  } from '$lib/modelProviders.js';

  let { capsuleId } = $props();

  const COPY = {
    en: {
      title: 'Model provider',
      lead: 'The key stays in this Admin. Only provider and model are saved to the Team.',
      provider: 'Provider',
      model: 'Model',
      key: 'API key',
      addKey: 'Paste an API key',
      keepKey: 'Leave empty to keep the saved key',
      configured: 'key saved',
      missing: 'key required',
      save: 'Save model',
      saving: 'Saving…',
      saved: 'Model ready',
      remove: 'Remove key',
      removeConfirm: 'Remove this provider API key from the local Admin?',
      loading: 'Loading model settings…',
      loadFailed: 'Model settings are unavailable.',
    },
    pt: {
      title: 'Provedor do modelo',
      lead: 'A chave fica neste Admin. Apenas provedor e modelo são salvos no Time.',
      provider: 'Provedor',
      model: 'Modelo',
      key: 'Chave da API',
      addKey: 'Cole uma chave de API',
      keepKey: 'Deixe vazio para manter a chave salva',
      configured: 'chave salva',
      missing: 'chave necessária',
      save: 'Salvar modelo',
      saving: 'Salvando…',
      saved: 'Modelo pronto',
      remove: 'Remover chave',
      removeConfirm: 'Remover esta chave de API do Admin local?',
      loading: 'Carregando configuração do modelo…',
      loadFailed: 'A configuração do modelo está indisponível.',
    },
  };

  let phase = $state('loading');
  let providers = $state([]);
  let provider = $state('openai');
  let model = $state('gpt-5.5');
  let apiKey = $state('');
  let error = $state('');
  let saved = $state(false);

  let copy = $derived(COPY[$locale] ?? COPY.en);
  let selected = $derived(providers.find((entry) => entry.id === provider) ?? null);

  async function load() {
    phase = 'loading';
    error = '';
    try {
      const [providerList, inference] = await Promise.all([
        listModelProviders(fetch),
        loadInference(fetch, capsuleId),
      ]);
      providers = providerList;
      if (inference) {
        provider = inference.provider;
        model = inference.model;
      } else {
        const fallback = providers.find((entry) => entry.id === provider) ?? providers[0];
        provider = fallback.id;
        model = fallback.default_model;
      }
      phase = 'ready';
    } catch (reason) {
      error = reason instanceof Error ? reason.message : copy.loadFailed;
      phase = 'error';
    }
  }

  function selectProvider(event) {
    provider = event.currentTarget.value;
    const next = providers.find((entry) => entry.id === provider);
    if (next) model = next.default_model;
    apiKey = '';
    saved = false;
    error = '';
  }

  async function save(event) {
    event.preventDefault();
    if (phase === 'saving') return;
    phase = 'saving';
    error = '';
    saved = false;
    try {
      const result = await saveModelSetup(fetch, capsuleId, { provider, model: model.trim(), apiKey }, providers);
      apiKey = '';
      providers = providers.map((entry) => entry.id === provider ? result.providerState : entry);
      saved = true;
      phase = 'ready';
    } catch (reason) {
      apiKey = '';
      error = reason instanceof Error ? reason.message : copy.loadFailed;
      phase = 'ready';
    }
  }

  async function removeKey() {
    if (!selected?.configured || phase === 'saving' || !window.confirm(copy.removeConfirm)) return;
    phase = 'saving';
    error = '';
    saved = false;
    try {
      const state = await removeModelKey(fetch, provider);
      providers = providers.map((entry) => entry.id === provider ? state : entry);
    } catch (reason) {
      error = reason instanceof Error ? reason.message : copy.loadFailed;
    } finally {
      phase = 'ready';
    }
  }

  onMount(load);
</script>

<section class="model-panel" aria-labelledby={`model-title-${capsuleId}`}>
  <header>
    <div>
      <h3 id={`model-title-${capsuleId}`}>{copy.title}</h3>
      <p>{copy.lead}</p>
    </div>
    {#if selected}
      <span class:ready={selected.configured}>{selected.configured ? copy.configured : copy.missing}</span>
    {/if}
  </header>

  {#if phase === 'loading'}
    <p class="state">{copy.loading}</p>
  {:else if phase === 'error'}
    <div class="error" role="alert"><span>{error}</span><button type="button" onclick={load}>Retry</button></div>
  {:else}
    <form onsubmit={save}>
      <label>
        <span>{copy.provider}</span>
        <select value={provider} onchange={selectProvider} disabled={phase === 'saving'}>
          {#each providers as entry (entry.id)}
            <option value={entry.id}>{entry.title}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>{copy.model}</span>
        <input bind:value={model} maxlength="128" autocomplete="off" spellcheck="false" required disabled={phase === 'saving'} />
      </label>
      <label class="key-field">
        <span>{copy.key}</span>
        <input
          type="password"
          bind:value={apiKey}
          placeholder={selected?.configured ? copy.keepKey : copy.addKey}
          minlength="16"
          maxlength="8192"
          autocomplete="off"
          spellcheck="false"
          disabled={phase === 'saving'}
        />
      </label>
      <div class="actions">
        {#if selected?.configured}
          <button class="remove" type="button" onclick={removeKey} disabled={phase === 'saving'}>{copy.remove}</button>
        {/if}
        <button class="save" type="submit" disabled={phase === 'saving' || !model.trim()}>
          {phase === 'saving' ? copy.saving : copy.save}
        </button>
      </div>
    </form>
    {#if error}<p class="message error-text" role="alert">{error}</p>{/if}
    {#if saved}<p class="message success" role="status">✓ {copy.saved}</p>{/if}
  {/if}
</section>

<style>
  .model-panel { padding: 1.05rem 1.1rem; border-top: 1px solid var(--border); }
  header { display: flex; align-items: start; justify-content: space-between; gap: 0.8rem; }
  h3 { margin: 0; font-size: 0.78rem; }
  header p { margin: 0.25rem 0 0; color: var(--text-faint); font-size: 0.7rem; line-height: 1.45; }
  header > span { flex: none; padding: 0.15rem 0.4rem; border: 1px solid rgba(255, 96, 125, 0.35); color: var(--danger); font-family: var(--font-mono); font-size: 0.48rem; letter-spacing: 0.08em; text-transform: uppercase; }
  header > span.ready { border-color: rgba(5, 255, 161, 0.35); color: var(--success); }
  form { display: grid; grid-template-columns: 0.75fr 1fr; gap: 0.65rem; margin-top: 0.85rem; }
  label { display: grid; gap: 0.3rem; }
  label > span { color: var(--text-faint); font-family: var(--font-mono); font-size: 0.5rem; letter-spacing: 0.08em; text-transform: uppercase; }
  input, select { width: 100%; min-width: 0; min-height: 2.35rem; border: 1px solid var(--border-strong); padding: 0 0.65rem; background: #050708; color: var(--text); font-family: var(--font-mono); font-size: 0.66rem; }
  input:focus, select:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 1px rgba(0, 240, 255, 0.18); }
  .key-field, .actions { grid-column: 1 / -1; }
  .actions { display: flex; justify-content: flex-end; gap: 0.45rem; }
  button { min-height: 2.2rem; border: 1px solid var(--border-strong); padding: 0 0.65rem; background: transparent; color: var(--text-dim); cursor: pointer; font-family: var(--font-mono); font-size: 0.55rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  button.save { border: 0; background: var(--accent); color: #001013; }
  button.remove { border-color: rgba(255, 96, 125, 0.35); color: var(--danger); }
  button:disabled { cursor: not-allowed; opacity: 0.42; }
  .state, .message { margin: 0.75rem 0 0; color: var(--text-faint); font-size: 0.68rem; line-height: 1.45; }
  .error { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-top: 0.75rem; color: var(--danger); font-size: 0.68rem; }
  .error-text { color: var(--danger); }
  .success { color: var(--success); font-family: var(--font-mono); }
  @media (max-width: 520px) { form { grid-template-columns: 1fr; } .key-field, .actions { grid-column: auto; } }
</style>
