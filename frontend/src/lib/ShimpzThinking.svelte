<script>
  let { label = 'Your Team is thinking…' } = $props();
</script>

<div class="thinking" role="status" aria-live="polite" aria-atomic="true">
  <span class="mark" aria-hidden="true">
    <span class="signal"></span>
    <img src="/brand/shimpz-thinking.svg" alt="" />
    <span class="scan"></span>
  </span>
  <span class="label">{label}<span class="dots"><i></i><i></i><i></i></span></span>
</div>

<style>
  .thinking {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.055em;
  }

  .mark {
    position: relative;
    display: grid;
    width: 3.25rem;
    height: 3.25rem;
    flex: 0 0 auto;
    place-items: center;
    isolation: isolate;
  }

  .mark::before,
  .signal {
    position: absolute;
    content: '';
    pointer-events: none;
  }

  .mark::before {
    inset: 0.2rem;
    z-index: -2;
    border: 1px solid rgba(0, 240, 255, 0.3);
    clip-path: polygon(18% 0, 82% 0, 100% 18%, 100% 82%, 82% 100%, 18% 100%, 0 82%, 0 18%);
    animation: frame-breathe 2.8s ease-in-out infinite;
  }

  .signal {
    inset: 0.52rem;
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0, 240, 255, 0.16), transparent 68%);
    filter: blur(0.18rem);
    animation: signal-breathe 2.8s ease-in-out infinite;
  }

  img {
    display: block;
    width: 2.85rem;
    height: 2.85rem;
    object-fit: contain;
    filter: drop-shadow(0 0 0.18rem rgba(0, 240, 255, 0.35));
    animation: chimp-breathe 2.8s ease-in-out infinite;
  }

  .scan {
    position: absolute;
    inset: 0.32rem;
    overflow: hidden;
    clip-path: polygon(18% 0, 82% 0, 100% 18%, 100% 82%, 82% 100%, 18% 100%, 0 82%, 0 18%);
    pointer-events: none;
  }

  .scan::after {
    position: absolute;
    top: -20%;
    left: -45%;
    width: 22%;
    height: 140%;
    background: linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.52), transparent);
    content: '';
    filter: blur(0.08rem);
    transform: skewX(-12deg);
    animation: scan 2.35s ease-in-out infinite;
  }

  .label {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .dots {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    margin-inline-start: 0.35rem;
  }

  .dots i {
    width: 0.22rem;
    height: 0.22rem;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0.3rem rgba(0, 240, 255, 0.58);
    animation: dot 1.2s ease-in-out infinite;
  }

  .dots i:nth-child(2) { animation-delay: 0.16s; }
  .dots i:nth-child(3) { animation-delay: 0.32s; }

  @keyframes chimp-breathe {
    0%, 100% { transform: translateY(0) scale(0.98); filter: drop-shadow(0 0 0.14rem rgba(0, 240, 255, 0.28)); }
    50% { transform: translateY(-0.08rem) scale(1); filter: drop-shadow(0 0 0.35rem rgba(0, 240, 255, 0.52)); }
  }

  @keyframes frame-breathe {
    0%, 100% { border-color: rgba(0, 240, 255, 0.22); transform: scale(0.96); }
    50% { border-color: rgba(255, 46, 116, 0.42); transform: scale(1); }
  }

  @keyframes signal-breathe {
    0%, 100% { opacity: 0.4; transform: scale(0.82); }
    50% { opacity: 1; transform: scale(1.08); }
  }

  @keyframes scan {
    0%, 16% { left: -45%; opacity: 0; }
    24% { opacity: 0.82; }
    66% { left: 124%; opacity: 0.65; }
    74%, 100% { left: 124%; opacity: 0; }
  }

  @keyframes dot {
    0%, 70%, 100% { opacity: 0.28; transform: translateY(0); }
    35% { opacity: 1; transform: translateY(-0.12rem); }
  }

  @media (prefers-reduced-motion: reduce) {
    .mark::before,
    .signal,
    img,
    .scan::after,
    .dots i {
      animation: none;
    }

    .dots i { opacity: 0.7; }
  }
</style>
