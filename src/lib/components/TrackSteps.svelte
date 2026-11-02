<script>
  import { m } from '#lib/paraglide/messages.js';
  /** @type {{ steps?: { key: string, label: string, time: string }[], current?: number, vehicle?: 'bike' | 'car', finished?: boolean }} */
  let { steps = [], current = 0, vehicle = 'bike', finished = false } = $props();

  /** @type {Record<string, string>} */
  const icons = {
    placed: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    confirmed: '<path d="M20 6 9 17l-5-5"/>',
    preparing: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.4.4 1.6 1.4 2.9 2.5 2.9z"/>',
    ready: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
    bike: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
    car: '<path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/><path d="M5 12h14"/>',
    delivered: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
  };
  const iconFor = (/** @type {string} */ key) =>
    key === 'picked_up' || key === 'on_the_way' ? icons[vehicle] :
    key === 'collected' ? icons.delivered : (icons[key] ?? icons.placed);

  const n = $derived(steps.length);
  const stateOf = (/** @type {number} */ i) => (finished || i < current ? 'done' : i === current ? 'current' : 'next');
  // progress from the first circle's centre to the current circle's centre
  const progress = $derived(n > 1 ? Math.min(finished ? n - 1 : current, n - 1) / (n - 1) : 0);
</script>

<ol class="ts" style="--n:{n}; --p:{progress}" aria-label={m.track_progress_label()}>
  <span class="ts-rail" aria-hidden="true"><span class="ts-fill"></span></span>
  {#each steps as s, i}
    {@const st = stateOf(i)}
    <li class="ts-step {st}" aria-current={st === 'current' ? 'step' : undefined}>
      <span class="circle" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          {@html st === 'done' ? icons.check : iconFor(s.key)}
        </svg>
      </span>
      <span class="ts-label">{s.label}</span>
      <span class="time">{s.time}</span>
    </li>
  {/each}
</ol>

<style>
  /* Note: internal classes are prefixed `ts-` to avoid colliding with the global
     `.rail` / `.step` / `.label` rules in app.css (the sidebar rail's `.rail`
     even carries a `display:none` media query that would hide the connector). */
  .ts {
    --size: 44px;
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* rail runs from the centre of the first circle to the centre of the last */
  .ts-rail {
    position: absolute;
    top: calc(var(--size) / 2 - 2px);
    left: calc(50% / var(--n));
    right: calc(50% / var(--n));
    height: 4px;
    border-radius: 2px;
    background: #EEDDD9;
    z-index: 0;
  }
  .ts-fill {
    position: absolute;
    inset: 0 auto 0 0;
    width: calc(var(--p) * 100%);
    border-radius: 2px;
    background: var(--green);
    transition: width .6s ease;
  }
  .ts-step {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 0 4px;
    min-width: 0;
  }
  .circle {
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #fff;
    border: 2px solid #DFC5C0;
    color: #8A7D7B;
    box-shadow: 0 0 0 6px #fff;          /* clean gap where the rail meets the circle */
    opacity: 1 !important;
    filter: none !important;
  }
  .done .circle { background: var(--green); border-color: var(--green); color: #fff; }
  .current .circle {
    background: #E23744; border-color: #E23744; color: #fff;
    box-shadow: 0 0 0 6px #fff, 0 0 0 11px rgba(226, 55, 68, .16);
    animation: pulse 2s ease-in-out infinite;
  }
  .ts-label {
    margin-top: 12px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
    color: #241B1B;
    white-space: nowrap;
  }
  .current .ts-label { color: #B3212F; }
  .next .ts-label { color: #67585B; font-weight: 500; }
  .time { margin-top: 3px; font-size: 12.5px; color: #67585B; white-space: nowrap; }

  @keyframes pulse {
    50% { box-shadow: 0 0 0 6px #fff, 0 0 0 15px rgba(226, 55, 68, .06); }
  }
  @media (prefers-reduced-motion: reduce) {
    .current .circle { animation: none; }
    .ts-fill { transition: none; }
  }

  /* phones: vertical list */
  @media (max-width: 760px) {
    .ts { display: block; --size: 32px; }
    .ts-rail {
      top: calc(var(--size) / 2);
      bottom: calc(var(--size) / 2 + 22px);
      left: calc(var(--size) / 2 - 1px);
      right: auto;
      width: 2px;
      height: auto;
    }
    .ts-fill { width: 100%; height: calc(var(--p) * 100%); inset: 0 auto auto 0; transition: height .6s ease; }
    .ts-step {
      display: grid;
      grid-template-columns: var(--size) 1fr auto;
      align-items: center;
      gap: 12px;
      text-align: left;
      padding: 0 0 22px;
    }
    .ts-step:last-child { padding-bottom: 0; }
    .circle svg { width: 16px; height: 16px; }
    .ts-label { margin: 0; white-space: normal; }
    .time { margin: 0; }
  }
</style>
