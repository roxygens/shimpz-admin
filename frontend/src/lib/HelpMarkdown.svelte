<script>
  import HelpInline from '$lib/HelpInline.svelte';
  import { parseHelpMarkdown } from '$lib/helpMarkdown.js';

  let { markdown = '', variant = 'help' } = $props();
  let blocks = $derived(parseHelpMarkdown(markdown));
</script>

<div class="help-markdown" class:chat={variant === 'chat'}>
  {#each blocks as block}
    {#if block.type === 'heading' && block.level === 1}
      <h1><HelpInline tokens={block.inlines} /></h1>
    {:else if block.type === 'heading' && block.level === 2}
      <h2><HelpInline tokens={block.inlines} /></h2>
    {:else if block.type === 'heading'}
      <h3><HelpInline tokens={block.inlines} /></h3>
    {:else if block.type === 'code'}
      <pre><code>{block.text}</code></pre>
    {:else if block.type === 'list' && block.ordered}
      <ol>{#each block.items as item}<li><HelpInline tokens={item} /></li>{/each}</ol>
    {:else if block.type === 'list'}
      <ul>{#each block.items as item}<li><HelpInline tokens={item} /></li>{/each}</ul>
    {:else}
      <p><HelpInline tokens={block.inlines} /></p>
    {/if}
  {/each}
</div>

<style>
  .help-markdown { color: var(--text-dim); font-size: 0.76rem; line-height: 1.62; }
  .help-markdown.chat { color: var(--text); font-size: inherit; line-height: 1.55; }
  h1, h2, h3 { margin: 1.2rem 0 0.55rem; color: var(--text); line-height: 1.22; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  h1 { font-size: 1.15rem; }
  h2 { font-size: 0.92rem; }
  h3 { font-size: 0.8rem; }
  p, ul, ol { margin: 0.55rem 0; }
  .chat > :first-child { margin-top: 0; }
  .chat > :last-child { margin-bottom: 0; }
  ul, ol { padding-inline-start: 1.3rem; }
  li + li { margin-top: 0.28rem; }
  pre { overflow-x: auto; margin: 0.75rem 0; border: 1px solid var(--border-strong); padding: 0.75rem; background: #030506; }
  code { color: var(--accent); font-family: var(--font-mono); font-size: 0.9em; }
  .help-markdown :global(a) { color: var(--accent); text-decoration: underline; text-decoration-color: var(--accent-alt); text-underline-offset: 0.2em; }
  .help-markdown :global(a:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
