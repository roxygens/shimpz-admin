<script>
  import { onMount } from 'svelte';
  import AdminShell from '$lib/AdminShell.svelte';
  import LocaleMenu from '$lib/LocaleMenu.svelte';
  import { INSTALL_INTENT, acknowledgeStoreInstallIntent } from '$lib/assistantIntent.js';
  import { evaluateHelloPulse, listInstalledAssistants, safeApiError } from '$lib/localApi.js';
  import { t, locale } from '$lib/i18n.js';

  const HELLO_ID = INSTALL_INTENT.assistant;
  const CID_RE = /^[a-z0-9_]{1,40}$/;
  const LOCAL_COPY = {
    en: {
      runHello: 'Run hello',
      installedTitle: 'Installed in this Capsule',
      installedEmpty: 'No Assistants installed in this Capsule.',
      inventoryLoading: 'Reading installed Assistants…',
      installedNow: 'Installed now',
      alreadyInstalled: 'Already installed',
      noCapsules: 'Create a running Capsule before evaluating an Assistant.',
      createCapsule: 'Create a Capsule',
      confirmTitle: 'Install Hello Pulse?',
      confirmLead: 'Choose the exact Capsule. The Store cannot choose it or install anything for you.',
      checkingTitle: 'Preparing the local action…',
      checkingLead: 'The Admin is checking the selected Capsule and its installed Assistants.',
      alreadyTitle: 'Hello Pulse is already installed.',
      alreadyLead: 'Nothing was installed twice. You can run its hello operation now.',
      noCapsuleTitle: 'Create a running Capsule first.',
      noCapsuleLead: 'An Assistant always belongs to one Capsule, so the Admin needs a destination before installation.',
      unavailableTitle: 'Hello Pulse is unavailable right now.',
      unavailableLead: 'The local catalog or installed inventory could not be verified. Retry the local data before installing.',
      successTitle: 'Hello Pulse is ready.',
      successLead: 'The Assistant is installed in the selected Capsule and its declared hello operation responded.',
      failureTitle: 'The local action did not finish.',
      failureLead: 'Nothing was hidden. Review the error below and retry when the local controller is available.',
      capsuleLabel: 'Destination Capsule',
      capsulePlaceholder: 'Select a Capsule',
      cancel: 'Cancel',
      close: 'Close',
      preparing: 'Checking…',
      confirm: 'Confirm install',
      runInstalled: 'Run hello',
      retryAction: 'Try again',
      working: 'Installing and running…',
      result: 'Hello result',
      uninstall: 'Uninstall from Capsule',
      uninstallConfirm: 'Uninstall {assistant} from {capsule}?',
      removed: '{assistant} was uninstalled from {capsule}.',
      loadFailed: 'The local Assistant control plane is unavailable.',
      retry: 'Retry local data',
      genericFailure: 'The local evaluation could not be completed.',
    },
    pt: {
      runHello: 'Executar hello',
      installedTitle: 'Instalados nesta Cápsula',
      installedEmpty: 'Nenhum Assistant instalado nesta Cápsula.',
      inventoryLoading: 'Lendo Assistants instalados…',
      installedNow: 'Instalado agora',
      alreadyInstalled: 'Já estava instalado',
      noCapsules: 'Crie uma Cápsula em execução antes de avaliar um Assistant.',
      createCapsule: 'Criar uma Cápsula',
      confirmTitle: 'Instalar o Hello Pulse?',
      confirmLead: 'Escolha a Cápsula exata. A Store não pode escolhê-la nem instalar nada por você.',
      checkingTitle: 'Preparando a ação local…',
      checkingLead: 'O Admin está verificando a Cápsula selecionada e seus Assistants instalados.',
      alreadyTitle: 'O Hello Pulse já está instalado.',
      alreadyLead: 'Nada foi instalado duas vezes. Você pode executar a operação hello agora.',
      noCapsuleTitle: 'Crie primeiro uma Cápsula em execução.',
      noCapsuleLead: 'Um Assistant sempre pertence a uma Cápsula, então o Admin precisa de um destino antes da instalação.',
      unavailableTitle: 'O Hello Pulse está indisponível agora.',
      unavailableLead: 'Não foi possível verificar o catálogo local ou o inventário instalado. Atualize os dados locais antes de instalar.',
      successTitle: 'O Hello Pulse está pronto.',
      successLead: 'O Assistant está instalado na Cápsula selecionada e sua operação hello declarada respondeu.',
      failureTitle: 'A ação local não foi concluída.',
      failureLead: 'Nada foi ocultado. Revise o erro abaixo e tente novamente quando o controller local estiver disponível.',
      capsuleLabel: 'Cápsula de destino',
      capsulePlaceholder: 'Selecione uma Cápsula',
      cancel: 'Cancelar',
      close: 'Fechar',
      preparing: 'Verificando…',
      confirm: 'Confirmar instalação',
      runInstalled: 'Executar hello',
      retryAction: 'Tentar novamente',
      working: 'Instalando e executando…',
      result: 'Resultado do hello',
      uninstall: 'Desinstalar da Cápsula',
      uninstallConfirm: 'Desinstalar {assistant} de {capsule}?',
      removed: '{assistant} foi desinstalado de {capsule}.',
      loadFailed: 'O plano de controle local de Assistants está indisponível.',
      retry: 'Tentar dados locais novamente',
      genericFailure: 'Não foi possível concluir a avaliação local.',
    },
  };

  let phase = $state('checking');
  let capsules = $state([]);
  let catalog = $state([]);
  let localError = $state('');
  let dialogError = $state('');
  let busy = $state(false);
  let activeCapsule = $state('');
  let selectedCapsule = $state('');
  let installedAssistants = $state([]);
  let inventoryPhase = $state('idle');
  let inventoryError = $state('');
  let inventoryAttempt = 0;
  let localDataPhase = $state('idle');
  let localDataRequest = Promise.resolve();
  let pendingAssistant = $state('');
  let evaluation = $state(null);
  let iframeElement = $state();
  let confirmDialog = $state();
  let dialogMode = $state('install');
  let dialogResult = $state(null);
  let dialogAttempt = 0;

  let currentLocale = $derived($locale);
  let copy = $derived(LOCAL_COPY[currentLocale] ?? LOCAL_COPY.en);
  let storeLocale = $derived(currentLocale === 'pt' ? 'pt' : 'en');
  let storeUrl = $derived(`https://shimpz.com/${storeLocale}/assistants/embed`);
  let runningCapsules = $derived(capsules.filter((capsule) => capsule.status === 'running'));
  let helloEntry = $derived(catalog.find((entry) => entry.id === HELLO_ID));
  let helloAvailable = $derived(Boolean(helloEntry && declaresHello(helloEntry)));
  let activeCapsuleRecord = $derived(runningCapsules.find((capsule) => capsule.id === activeCapsule) ?? null);
  let selectedCapsuleRecord = $derived(runningCapsules.find((capsule) => capsule.id === selectedCapsule) ?? null);
  let helloInstalled = $derived(installedAssistants.some((entry) => entry.assistant === HELLO_ID));
  let dialogTitle = $derived({
    checking: copy.checkingTitle,
    install: copy.confirmTitle,
    installed: copy.alreadyTitle,
    'no-capsule': copy.noCapsuleTitle,
    unavailable: copy.unavailableTitle,
    success: copy.successTitle,
    error: copy.failureTitle,
  }[dialogMode] ?? copy.confirmTitle);
  let dialogLead = $derived({
    checking: copy.checkingLead,
    install: copy.confirmLead,
    installed: copy.alreadyLead,
    'no-capsule': copy.noCapsuleLead,
    unavailable: copy.unavailableLead,
    success: copy.successLead,
    error: copy.failureLead,
  }[dialogMode] ?? copy.confirmLead);

  function declaresHello(entry) {
    if (Array.isArray(entry?.operations)) {
      return entry.operations.some((operation) => operation === 'hello' || operation?.id === 'hello');
    }
    return Boolean(entry?.operations && typeof entry.operations === 'object' && entry.operations.hello);
  }

  function normalizeCapsules(document) {
    if (!document || !Array.isArray(document.capsules)) return [];
    return document.capsules
      .filter((item) => item && typeof item === 'object' && CID_RE.test(item.id))
      .map((item) => ({
        id: item.id,
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 80) : item.id,
        status: typeof item.status === 'string' ? item.status : 'unknown',
      }));
  }

  function normalizeCatalog(document) {
    if (!document || !Array.isArray(document.assistants)) return [];
    return document.assistants.filter((item) => item && typeof item === 'object' && item.id === HELLO_ID);
  }

  async function jsonObject(response) {
    const body = await response.json().catch(() => ({}));
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  }

  function format(message, values) {
    let output = message;
    for (const [key, value] of Object.entries(values)) output = output.replaceAll(`{${key}}`, value);
    return output;
  }

  async function loadInstalled(capsuleId = activeCapsule) {
    const attempt = ++inventoryAttempt;
    installedAssistants = [];
    inventoryError = '';
    if (!capsuleId) {
      inventoryPhase = 'idle';
      return;
    }
    inventoryPhase = 'loading';
    try {
      const inventory = await listInstalledAssistants(fetch, capsuleId);
      if (attempt !== inventoryAttempt || capsuleId !== activeCapsule) return;
      installedAssistants = inventory;
      inventoryPhase = 'ready';
    } catch (error) {
      if (attempt !== inventoryAttempt || capsuleId !== activeCapsule) return;
      inventoryError = error instanceof Error ? error.message : copy.loadFailed;
      inventoryPhase = 'error';
    }
  }

  async function selectCapsule(event) {
    activeCapsule = event.currentTarget.value;
    const url = new URL(location.href);
    url.searchParams.set('capsule', activeCapsule);
    history.replaceState(history.state, '', url);
    evaluation = null;
    await loadInstalled(activeCapsule);
  }

  async function loadLocalData() {
    localDataPhase = 'loading';
    localError = '';
    try {
      const [capsuleResponse, catalogResponse] = await Promise.all([
        fetch('/api/capsules', { cache: 'no-store', headers: { Accept: 'application/json' } }),
        fetch('/api/assistants', { cache: 'no-store', headers: { Accept: 'application/json' } }),
      ]);
      if (capsuleResponse.status === 401 || catalogResponse.status === 401) {
        phase = 'needauth';
        localDataPhase = 'error';
        return;
      }
      const [capsuleBody, catalogBody] = await Promise.all([
        jsonObject(capsuleResponse),
        jsonObject(catalogResponse),
      ]);
      if (!capsuleResponse.ok) throw new Error(safeApiError(capsuleBody, copy.loadFailed));
      if (!catalogResponse.ok) throw new Error(safeApiError(catalogBody, copy.loadFailed));
      capsules = normalizeCapsules(capsuleBody);
      catalog = normalizeCatalog(catalogBody);
      const requestedCapsule = new URL(location.href).searchParams.get('capsule') ?? '';
      if (capsules.some((capsule) => capsule.id === requestedCapsule && capsule.status === 'running')) {
        activeCapsule = requestedCapsule;
      }
      if (!capsules.some((capsule) => capsule.id === activeCapsule && capsule.status === 'running')) {
        activeCapsule = capsules.find((capsule) => capsule.status === 'running')?.id ?? '';
      }
      await loadInstalled(activeCapsule);
      localDataPhase = inventoryPhase === 'error' ? 'error' : 'ready';
    } catch (error) {
      localError = error instanceof Error ? error.message : copy.loadFailed;
      catalog = [];
      localDataPhase = 'error';
    }
  }

  function refreshLocalData() {
    localDataRequest = loadLocalData();
    return localDataRequest;
  }

  async function checkSession() {
    phase = 'checking';
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      if (!response.ok) throw new Error('session unavailable');
      if (!(await response.json()).authenticated) {
        phase = 'needauth';
        return;
      }
      phase = 'ready';
      await refreshLocalData();
    } catch {
      phase = 'needauth';
    }
  }

  function showInstallDialog() {
    if (confirmDialog && !confirmDialog.open) confirmDialog.showModal();
  }

  async function beginInstall(assistantId) {
    const attempt = ++dialogAttempt;
    pendingAssistant = assistantId;
    selectedCapsule = activeCapsuleRecord?.id ?? '';
    dialogError = '';
    dialogResult = null;
    dialogMode = 'checking';
    showInstallDialog();

    if (assistantId !== HELLO_ID) {
      dialogMode = 'unavailable';
      return;
    }
    if (localDataPhase === 'loading') await localDataRequest;
    if (attempt !== dialogAttempt) return;

    const capsule = activeCapsuleRecord;
    selectedCapsule = capsule?.id ?? '';
    if (localDataPhase === 'error') {
      dialogMode = 'unavailable';
      return;
    }
    if (!capsule) {
      dialogMode = 'no-capsule';
      return;
    }
    if (!helloAvailable) {
      dialogMode = 'unavailable';
      return;
    }
    if (inventoryPhase === 'loading') await loadInstalled(capsule.id);
    if (attempt !== dialogAttempt) return;
    if (inventoryPhase === 'error') {
      dialogMode = 'unavailable';
      return;
    }
    dialogMode = installedAssistants.some((entry) => entry.assistant === HELLO_ID) ? 'installed' : 'install';
  }

  function handleStoreMessage(event) {
    if (!acknowledgeStoreInstallIntent(event, iframeElement?.contentWindow)) return;
    void beginInstall(event.data.assistant);
  }

  async function confirmInstall() {
    if (
      busy ||
      pendingAssistant !== HELLO_ID ||
      !helloAvailable ||
      !['install', 'installed', 'error'].includes(dialogMode)
    ) return;
    const capsule = runningCapsules.find((item) => item.id === selectedCapsule);
    if (!capsule) return;

    busy = true;
    dialogError = '';
    dialogResult = null;
    try {
      const { message, installed } = await evaluateHelloPulse(fetch, capsule.id);
      dialogResult = { note: installed ? copy.installedNow : copy.alreadyInstalled, message };
      dialogMode = 'success';
      activeCapsule = capsule.id;
      await loadInstalled(capsule.id);
    } catch (error) {
      dialogError = error instanceof Error ? error.message : copy.genericFailure;
      dialogMode = 'error';
    } finally {
      busy = false;
    }
  }

  function closeInstallDialog() {
    dialogAttempt += 1;
    confirmDialog?.close();
  }

  async function runHello() {
    if (busy || !activeCapsuleRecord || !helloInstalled) return;
    busy = true;
    localError = '';
    evaluation = null;
    try {
      const { message } = await evaluateHelloPulse(fetch, activeCapsuleRecord.id);
      evaluation = { kind: 'success', note: copy.alreadyInstalled, message };
      await loadInstalled(activeCapsuleRecord.id);
    } catch (error) {
      localError = error instanceof Error ? error.message : copy.genericFailure;
    } finally {
      busy = false;
    }
  }

  async function uninstallInstalled(assistant) {
    if (busy || !activeCapsuleRecord) return;
    const question = format(copy.uninstallConfirm, {
      assistant: assistant.assistant,
      capsule: activeCapsuleRecord.name,
    });
    if (!window.confirm(question)) return;
    busy = true;
    localError = '';
    try {
      const response = await fetch(
        `/api/capsules/${encodeURIComponent(activeCapsuleRecord.id)}/assistants/${encodeURIComponent(assistant.assistant)}`,
        { method: 'DELETE', headers: { Accept: 'application/json' } },
      );
      const body = await jsonObject(response);
      if (!response.ok) throw new Error(safeApiError(body, copy.genericFailure));
      evaluation = {
        kind: 'removed',
        note: copy.uninstall,
        message: format(copy.removed, {
          assistant: assistant.assistant,
          capsule: activeCapsuleRecord.name,
        }),
      };
      await loadInstalled(activeCapsuleRecord.id);
    } catch (error) {
      localError = error instanceof Error ? error.message : copy.genericFailure;
    } finally {
      busy = false;
    }
  }

  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      location.assign('/');
    }
  }

  onMount(() => {
    window.addEventListener('message', handleStoreMessage);
    checkSession();
    return () => window.removeEventListener('message', handleStoreMessage);
  });
</script>

<svelte:head>
  <title>Assistants — Shimpz Admin</title>
  <meta name="description" content="Browse and evaluate trusted Shimpz Assistants from the local Admin." />
</svelte:head>

<AdminShell active="assistants" authenticated={phase === 'ready'} actions={shellActions}>
  {#if phase === 'checking'}
    <section class="state" aria-live="polite">
      <div class="pulse" aria-hidden="true"><span></span></div>
      <p>{$t('store.checking')}</p>
    </section>
  {:else if phase === 'needauth'}
    <section class="state">
      <p class="kicker">Space // protected route</p>
      <h1>{$t('store.needAuthTitle')}</h1>
      <p>{$t('store.needAuthLead')}</p>
      <a class="sign-in" href="/">{$t('store.signIn')} <span aria-hidden="true">→</span></a>
    </section>
  {:else}
    <header class="store-header">
      <div>
        <p class="kicker">{$t('store.kicker')}</p>
        <h1>{$t('store.nav')}</h1>
      </div>
      <a class="external" href={storeUrl.replace('/embed', '')} target="_blank" rel="noopener noreferrer">
        {$t('store.open')} <span aria-hidden="true">↗</span>
      </a>
    </header>

    <section class="store-workspace" aria-label={$t('store.frameTitle')}>
      <aside class="local-panel" aria-labelledby="local-inventory-title">
        <header>
          <div>
            <span>Local // Capsule</span>
            <strong id="local-inventory-title">{copy.installedTitle}</strong>
          </div>
          <b>{installedAssistants.length}</b>
        </header>
        {#if runningCapsules.length}
          <label class="capsule-picker" for="assistant-active-capsule">
            <span>{copy.capsuleLabel}</span>
            <select id="assistant-active-capsule" value={activeCapsule} disabled={busy} onchange={selectCapsule}>
              {#each runningCapsules as capsule (capsule.id)}
                <option value={capsule.id}>{capsule.name}</option>
              {/each}
            </select>
          </label>
        {:else}
          <div class="no-capsule">
            <p>{copy.noCapsules}</p>
            <a href="/capsules/">{copy.createCapsule}<span aria-hidden="true">→</span></a>
          </div>
        {/if}

        {#if localError}
          <div class="local-error" role="alert">
            <span>{localError}</span>
            <button type="button" onclick={refreshLocalData}>{copy.retry}</button>
          </div>
        {/if}

        <div class="installed-inventory" aria-live="polite">
          {#if inventoryPhase === 'loading'}
            <p>{copy.inventoryLoading}</p>
          {:else if inventoryPhase === 'error'}
            <div class="inventory-error" role="alert">
              <span>{inventoryError}</span>
              <button type="button" disabled={!activeCapsule} onclick={() => loadInstalled(activeCapsule)}>{copy.retry}</button>
            </div>
          {:else if installedAssistants.length}
            <ul>
              {#each installedAssistants as assistant (assistant.assistant)}
                <li>
                  <div class="installed-name">
                    <span class="installed-mark" aria-hidden="true">✓</span>
                    <strong>{assistant.assistant}</strong>
                    <small>{assistant.status}</small>
                  </div>
                  <div class="installed-actions">
                    {#if assistant.assistant === HELLO_ID}
                      <button type="button" disabled={busy} onclick={runHello}>{copy.runHello}</button>
                    {/if}
                    <button class="remove-assistant" type="button" disabled={busy} onclick={() => uninstallInstalled(assistant)}>
                      {copy.uninstall}
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          {:else if activeCapsule}
            <p>{copy.installedEmpty}</p>
          {/if}
        </div>

        {#if evaluation}
          <div class:removed={evaluation.kind === 'removed'} class="sidebar-result" role="status">
            <span>{evaluation.note ?? copy.result}</span>
            <strong>{evaluation.message}</strong>
          </div>
        {/if}
      </aside>

      <section class="store-frame" aria-labelledby="store-source">
        <header>
          <span id="store-source"><i aria-hidden="true"></i>{$t('store.source')}</span>
          <code>SHIMPZ // STORE</code>
        </header>
        <iframe
          bind:this={iframeElement}
          src={storeUrl}
          title={$t('store.frameTitle')}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="origin"
        ></iframe>
      </section>
    </section>

    <p class="trust-boundary"><span aria-hidden="true">◇</span>{$t('store.boundary')}</p>
  {/if}
</AdminShell>

<dialog bind:this={confirmDialog} aria-labelledby="assistant-confirm-title">
  <form class="dialog-panel" onsubmit={(event) => { event.preventDefault(); confirmInstall(); }}>
    <header>
      <p class="dialog-kicker">Assistant // local admission</p>
      <h2 id="assistant-confirm-title">{dialogTitle}</h2>
      <p>{dialogLead}</p>
    </header>
    {#if selectedCapsuleRecord}
      <div class="dialog-target">
        <span>{copy.capsuleLabel}</span>
        <strong>{selectedCapsuleRecord.name}</strong>
        <code>{selectedCapsuleRecord.id}</code>
      </div>
    {/if}
    {#if dialogMode === 'checking'}
      <p class="dialog-progress" role="status">{copy.preparing}</p>
    {:else if dialogMode === 'no-capsule'}
      <a class="dialog-route" href="/capsules/">{copy.createCapsule}<span aria-hidden="true">→</span></a>
    {/if}
    {#if dialogError}<p class="dialog-error" role="alert">{dialogError}</p>{/if}
    {#if dialogResult}
      <div class="dialog-result" role="status">
        <span>{dialogResult.note}</span>
        <strong>{dialogResult.message}</strong>
      </div>
    {/if}
    <footer>
      <button type="button" class="dialog-secondary" disabled={busy} onclick={closeInstallDialog}>
        {dialogMode === 'install' ? copy.cancel : copy.close}
      </button>
      {#if ['install', 'installed', 'error'].includes(dialogMode)}
        <button type="submit" class="dialog-primary" disabled={busy || !selectedCapsule || !helloAvailable}>
          {busy
            ? copy.working
            : dialogMode === 'installed'
              ? copy.runInstalled
              : dialogMode === 'error'
                ? copy.retryAction
                : copy.confirm}
        </button>
      {/if}
    </footer>
  </form>
</dialog>

{#snippet shellActions()}
  <LocaleMenu compact={phase !== 'ready'} />
  {#if phase === 'ready'}
    <button class="logout" type="button" onclick={logout} aria-label={$t('auth.logout')}>
      <span>{$t('auth.logout')}</span><b aria-hidden="true">↪</b>
    </button>
  {/if}
{/snippet}

<style>
  .logout {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.45rem;
    border: 0;
    padding: 0 0.8rem;
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--border-strong);
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
    color: var(--text-dim);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .logout b { color: var(--accent); }
  .logout:hover { color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }

  .store-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.9rem;
  }
  .kicker, .dialog-kicker {
    margin: 0 0 0.9rem;
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.19em;
    text-transform: uppercase;
  }
  h1 {
    max-width: 12ch;
    margin: 0;
    font-size: clamp(2rem, 5vw, 3.2rem);
    line-height: 1;
    letter-spacing: -0.065em;
    text-wrap: balance;
  }
  .external, .sign-in, .no-capsule a {
    display: inline-flex;
    min-height: 2.65rem;
    align-items: center;
    justify-content: space-between;
    gap: 1.3rem;
    padding: 0 1rem;
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--accent);
    clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-decoration: none;
    text-transform: uppercase;
  }
  .external:hover, .sign-in:hover { filter: drop-shadow(0 0 9px rgba(0, 240, 255, 0.32)); }

  .store-workspace {
    display: grid;
    grid-template-columns: minmax(15.5rem, 19rem) minmax(0, 1fr);
    align-items: start;
    gap: 1rem;
  }
  .local-panel {
    display: grid;
    gap: 0.9rem;
    min-width: 0;
    padding: 1rem;
    background: radial-gradient(circle at 0 0, rgba(0, 240, 255, 0.07), transparent 35%), var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--border-strong);
    clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut));
  }
  .local-panel > header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .local-panel > header div { display: grid; min-width: 0; gap: 0.25rem; }
  .local-panel > header span { color: var(--accent); font-family: var(--font-mono); font-size: 0.55rem; letter-spacing: 0.12em; text-transform: uppercase; }
  .local-panel > header strong { overflow: hidden; font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
  .local-panel > header b { display: grid; min-width: 1.6rem; height: 1.6rem; place-items: center; border: 1px solid var(--border-strong); color: var(--accent); font-family: var(--font-mono); font-size: 0.65rem; }
  .capsule-picker { display: grid; width: 100%; gap: 0.35rem; }
  .capsule-picker span { color: var(--text-faint); font-family: var(--font-mono); font-size: 0.56rem; letter-spacing: 0.09em; text-transform: uppercase; }
  .capsule-picker select { width: 100%; min-height: 2.55rem; border: 1px solid var(--border-strong); padding: 0 2rem 0 0.75rem; background: #050708; color: var(--text); font-family: var(--font-mono); font-size: 0.68rem; }
  .no-capsule { display: grid; gap: 0.7rem; }
  .no-capsule p { margin: 0; color: var(--text-dim); font-size: 0.75rem; line-height: 1.5; }
  .no-capsule a { min-height: 2.4rem; }
  .dialog-primary, .dialog-secondary, .local-error button {
    min-height: 2.8rem;
    border: 0;
    padding: 0 1rem;
    background: var(--accent);
    color: #001013;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  button:disabled { cursor: not-allowed; opacity: 0.42; }
  .local-error { display: grid; gap: 0.55rem; border-left: 2px solid var(--danger); padding: 0.65rem 0.7rem; background: rgba(255, 96, 125, 0.04); color: var(--danger); font-size: 0.7rem; line-height: 1.45; }
  .local-error button { min-height: 2rem; background: transparent; box-shadow: inset 0 0 0 1px var(--danger); color: var(--danger); }
  .installed-inventory { min-width: 0; border-top: 1px solid var(--border); padding-top: 0.8rem; }
  .installed-inventory > p { margin: 0; color: var(--text-faint); font-size: 0.72rem; line-height: 1.5; }
  .installed-inventory ul { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
  .installed-inventory li { display: grid; min-width: 0; gap: 0.55rem; border: 1px solid var(--border); padding: 0.6rem; background: rgba(0, 0, 0, 0.24); }
  .installed-name { display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.45rem; }
  .installed-mark { color: var(--success); font-family: var(--font-mono); }
  .installed-name strong { overflow: hidden; font-family: var(--font-mono); font-size: 0.7rem; text-overflow: ellipsis; white-space: nowrap; }
  .installed-name small { color: var(--success); font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.06em; text-transform: uppercase; }
  .installed-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .installed-inventory button, .inventory-error button { min-height: 2rem; border: 1px solid var(--border-strong); padding: 0 0.6rem; background: transparent; color: var(--accent); cursor: pointer; font-family: var(--font-mono); font-size: 0.56rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
  .installed-inventory .remove-assistant { border-color: rgba(255, 96, 125, 0.35); color: var(--danger); }
  .inventory-error { display: grid; gap: 0.55rem; color: var(--danger); font-size: 0.7rem; line-height: 1.45; }
  .sidebar-result { display: grid; gap: 0.3rem; border-left: 2px solid var(--success); padding: 0.65rem 0.7rem; background: rgba(5, 255, 161, 0.045); }
  .sidebar-result.removed { border-left-color: var(--accent-alt); background: rgba(255, 61, 242, 0.04); }
  .sidebar-result span { color: var(--success); font-family: var(--font-mono); font-size: 0.55rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .sidebar-result strong { font-size: 0.72rem; line-height: 1.45; }

  .store-frame {
    overflow: hidden;
    background: #000;
    box-shadow: inset 0 0 0 1px var(--border-strong), 0 20px 60px rgba(0, 0, 0, 0.4);
    clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut));
  }
  .store-frame > header { display: flex; min-height: 2.9rem; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 1rem; border-bottom: 1px solid var(--border); background: var(--surface-1); color: var(--text-faint); font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; }
  .store-frame > header span { display: inline-flex; align-items: center; gap: 0.5rem; }
  .store-frame > header i { width: 0.42rem; height: 0.42rem; background: var(--success); border-radius: 50%; box-shadow: 0 0 8px rgba(5, 255, 161, 0.55); }
  .store-frame code { color: var(--accent); font-size: inherit; }
  iframe { display: block; width: 100%; height: 34rem; border: 0; background: #000; }
  .trust-boundary { display: flex; max-width: 78ch; align-items: flex-start; gap: 0.65rem; margin: 1rem 0 0; color: var(--text-faint); font-size: 0.76rem; line-height: 1.6; }
  .trust-boundary span { color: var(--accent-alt); }

  dialog { width: min(34rem, calc(100vw - 2rem)); border: 0; padding: 0; background: transparent; color: var(--text); }
  dialog::backdrop { background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); }
  .dialog-panel { padding: clamp(1.4rem, 4vw, 2.2rem); background: var(--surface-1); box-shadow: inset 0 0 0 1px var(--border-strong), 0 24px 80px rgba(0, 0, 0, 0.65); clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut)); }
  .dialog-panel h2 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.5rem); letter-spacing: -0.05em; }
  .dialog-panel header > p:last-child { margin: 0.8rem 0 1.5rem; color: var(--text-dim); line-height: 1.6; }
  .dialog-target { display: grid; gap: 0.2rem; border: 1px solid var(--border-strong); padding: 0.8rem; background: #050708; }
  .dialog-target span { color: var(--text-faint); font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .dialog-target strong { font-size: 0.9rem; }
  .dialog-target code { color: var(--accent); font-size: 0.65rem; }
  .dialog-progress { margin: 1rem 0 0; color: var(--accent); font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .dialog-route { display: flex; min-height: 2.8rem; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1rem; padding: 0 0.9rem; background: var(--accent); color: #001013; font-family: var(--font-mono); font-size: 0.66rem; font-weight: 700; text-decoration: none; text-transform: uppercase; }
  .dialog-error { margin: 0.8rem 0 0; color: var(--danger); font-size: 0.78rem; line-height: 1.5; }
  .dialog-result { display: grid; gap: 0.35rem; margin-top: 1rem; border-left: 2px solid var(--success); padding: 0.85rem 1rem; background: rgba(5, 255, 161, 0.045); }
  .dialog-result span { color: var(--success); font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; }
  .dialog-result strong { font-size: 0.9rem; }
  .dialog-panel footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
  .dialog-secondary { background: transparent; box-shadow: inset 0 0 0 1px var(--border-strong); color: var(--text-dim); }

  .state { display: flex; min-height: 28rem; align-items: center; justify-content: center; flex-direction: column; border: 1px solid var(--border); background: radial-gradient(circle at 50% 35%, rgba(0, 240, 255, 0.055), transparent 48%), var(--surface-1); color: var(--text-dim); text-align: center; }
  .state h1 { max-width: 18ch; font-size: clamp(1.65rem, 4vw, 2.6rem); letter-spacing: -0.05em; }
  .state > p:not(.kicker) { max-width: 51ch; margin: 0.8rem 1rem 1.5rem; line-height: 1.65; }
  .pulse { position: relative; width: 4.6rem; height: 4.6rem; margin-bottom: 1.5rem; border: 1px solid var(--border-strong); border-radius: 50%; }
  .pulse::before, .pulse::after, .pulse span { position: absolute; border: 1px solid var(--accent); border-radius: 50%; content: ''; animation: pulse 1.8s ease-out infinite; }
  .pulse::before { inset: 1.5rem; }
  .pulse::after { inset: 0.8rem; animation-delay: 0.35s; }
  .pulse span { inset: 0; animation-delay: 0.7s; }
  @keyframes pulse { 0% { opacity: 0.8; transform: scale(0.7); } 100% { opacity: 0; transform: scale(1.12); } }

  @media (max-width: 960px) {
    .store-workspace { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .store-header { grid-template-columns: 1fr; align-items: start; }
    .external { width: 100%; }
    iframe { height: 32rem; }
  }
  @media (max-width: 520px) {
    .installed-actions { display: grid; }
    .installed-actions button { width: 100%; }
    .dialog-panel footer { align-items: stretch; flex-direction: column-reverse; }
  }
</style>
