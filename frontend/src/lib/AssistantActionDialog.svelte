<script>
  let {
    open = $bindable(false),
    title,
    lead,
    targetLabel = '',
    targetName = '',
    targetId = '',
    progress = '',
    hint = '',
    error = '',
    primaryLabel = '',
    secondaryLabel,
    primaryVisible = true,
    primaryDisabled = false,
    busy = false,
    destructive = false,
    onconfirm = () => {},
    oncancel = () => {},
  } = $props();

  let dialog;

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  function cancel(event) {
    event.preventDefault();
    if (!busy) oncancel();
  }

  function submit(event) {
    event.preventDefault();
    if (!busy && primaryVisible && !primaryDisabled) onconfirm();
  }
</script>

<dialog bind:this={dialog} aria-labelledby="assistant-action-title" oncancel={cancel}>
  <form class="dialog-panel" onsubmit={submit}>
    <header>
      <p class="dialog-kicker">Assistant // local admission</p>
      <h2 id="assistant-action-title">{title}</h2>
      <p>{lead}</p>
    </header>
    {#if targetName}
      <div class="dialog-target">
        <span>{targetLabel}</span>
        <strong>{targetName}</strong>
        {#if targetId}<code>{targetId}</code>{/if}
      </div>
    {/if}
    {#if progress}<p class="dialog-progress" role="status">{progress}</p>{/if}
    {#if hint}<p class="dialog-route-hint">{hint}</p>{/if}
    {#if error}<p class="dialog-error" role="alert">{error}</p>{/if}
    <footer>
      <button type="button" class="dialog-secondary" disabled={busy} onclick={oncancel}>
        {secondaryLabel}
      </button>
      {#if primaryVisible}
        <button
          type="submit"
          class:dialog-danger={destructive}
          class="dialog-primary"
          disabled={busy || primaryDisabled}>
          {primaryLabel}
        </button>
      {/if}
    </footer>
  </form>
</dialog>

<style>
  dialog {
    width: min(34rem, calc(100vw - 2rem));
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--text);
  }
  dialog::backdrop { background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); }
  .dialog-panel {
    --dialog-pad: clamp(1.4rem, 4vw, 2.2rem);
    padding: var(--dialog-pad);
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--border-strong), 0 24px 80px rgba(0, 0, 0, 0.65);
    clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut));
  }
  .dialog-kicker {
    margin: 0 0 0.9rem;
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.19em;
    text-transform: uppercase;
  }
  .dialog-panel h2 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.5rem); letter-spacing: -0.05em; }
  .dialog-panel header > p:last-child { margin: 0.8rem 0 1.5rem; color: var(--text-dim); line-height: 1.6; }
  .dialog-target { display: grid; gap: 0.2rem; border: 1px solid var(--border-strong); padding: 0.8rem; background: #050708; }
  .dialog-target span { color: var(--text-faint); font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .dialog-target strong { font-size: 0.9rem; }
  .dialog-target code { color: var(--accent); font-size: 0.65rem; }
  .dialog-progress { margin: 1rem 0 0; color: var(--accent); font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .dialog-route-hint { margin: 1rem 0 0; border-inline-start: 2px solid var(--accent); padding: 0.7rem 0.85rem; color: var(--text-dim); font-size: 0.72rem; line-height: 1.5; }
  .dialog-error { margin: 0.8rem 0 0; color: var(--danger); font-size: 0.78rem; line-height: 1.5; }
  footer {
    display: flex;
    gap: 0;
    margin: 1.5rem calc(0px - var(--dialog-pad)) calc(0px - var(--dialog-pad));
  }
  .dialog-primary,
  .dialog-secondary {
    min-height: 2.8rem;
    width: 100%;
    flex: 1 1 0;
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
  .dialog-secondary { background: transparent; box-shadow: inset 0 0 0 1px var(--border-strong); color: var(--text-dim); }
  footer button + button { box-shadow: inset 1px 0 0 var(--border-strong); }
  .dialog-danger { background: var(--danger); color: #160007; }
  button:disabled { cursor: not-allowed; opacity: 0.42; }
</style>
