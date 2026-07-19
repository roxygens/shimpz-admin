<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  import { locale } from '$lib/i18n.js';
  import { clearModelContext, loadModelContext, modelContext } from '$lib/modelContext.js';
  import { loadTeamContext, selectTeam, teamContext } from '$lib/teamContext.js';

  let { active = '' } = $props();

  const TEAM_ID_RE = /^[a-z0-9_]{1,40}$/;
  const COPY = {
    en: {
      retry: 'Retry local data',
    },
    pt: {
      retry: 'Tentar dados locais novamente',
    },
  };

  let copy = $derived($locale === 'pt' ? COPY.pt : COPY.en);
  let requestedTeamId = $derived.by(() => {
    const candidate = page.url.searchParams.get('team') ?? '';
    return TEAM_ID_RE.test(candidate) ? candidate : '';
  });

  function updateLocationTeam(id) {
    const next = new URL(page.url);
    next.searchParams.set('team', id);
    return goto(next, { replaceState: true, keepFocus: true, noScroll: true });
  }

  async function retry() {
    try {
      await loadTeamContext(fetch, $teamContext.selectedTeamId);
    } catch {
      // The shared context owns the visible fail-closed error state.
    }
  }

  $effect(() => {
    const preferredId = requestedTeamId;
    if (
      $teamContext.phase === 'ready' &&
      preferredId &&
      preferredId !== $teamContext.selectedTeamId &&
      $teamContext.teams.some((team) => team.id === preferredId)
    ) {
      const previousId = $teamContext.selectedTeamId;
      selectTeam(fetch, preferredId).catch(() => {
        if (previousId) updateLocationTeam(previousId).catch(() => {});
      });
    }
  });

  $effect(() => {
    const teamId = $teamContext.selectedTeamId;
    if (!teamId) {
      if ($modelContext.teamId) clearModelContext();
    } else if ($modelContext.teamId !== teamId || $modelContext.phase === 'idle') {
      loadModelContext(fetch, teamId).catch(() => {});
    }
  });

  onMount(() => {
    if ($teamContext.phase === 'idle') {
      loadTeamContext(fetch, requestedTeamId).catch(() => {});
    }
  });
</script>

{#if $teamContext.phase === 'error' && active !== 'chat'}
  <div class="context-error" role="alert">
    <p>{$teamContext.error}</p>
    <button type="button" onclick={retry}>{copy.retry}</button>
  </div>
{/if}

<style>
  .context-error {
    display: grid;
    min-width: 0;
    gap: 0.6rem;
    padding: 0.75rem 1.15rem;
  }

  .context-error {
    border-inline-start: 2px solid var(--danger);
    background: rgba(255, 96, 125, 0.045);
  }

  .context-error p {
    margin: 0;
    color: var(--danger);
    font-size: 0.67rem;
    line-height: 1.45;
  }

  .context-error button {
    min-height: 2.35rem;
    border: 1px solid var(--border-strong);
    padding: 0 0.7rem;
    background: transparent;
    color: var(--accent);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .context-error button:hover { background: rgba(0, 240, 255, 0.055); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
