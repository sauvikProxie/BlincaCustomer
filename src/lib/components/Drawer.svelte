<script>
	import { closeLayer, layers } from '#lib/layers.svelte.js';

	/** @type {{ layerId: number, side?: string, label?: string, className?: string, children: import('svelte').Snippet }} */
	let { layerId, side = 'right', label = '', className = '', children } = $props();

	let shown = $state(false);
	/** @type {HTMLElement|null} */
	let panel = $state(null);

	$effect(() => {
		const r = requestAnimationFrame(() => (shown = true));
		return () => cancelAnimationFrame(r);
	});

	$effect(() => {
		if (panel) {
			const f =
				/** @type {HTMLElement|null} */ (panel.querySelector('[autofocus]')) || panel;
			try {
				f.focus({ preventScroll: true });
			} catch {
				/* noop */
			}
			const layer = layers.find((l) => l.id === layerId);
			if (layer) layer.node = panel;
		}
	});

	/** @param {MouseEvent} e */
	function onClick(e) {
		const t = e.target;
		if (t instanceof Element && t.closest('[data-close]')) {
			e.preventDefault();
			closeLayer(layerId);
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (scrim click only; Escape is handled globally) -->
<div class="drawer-wrap side-{side}" class:is-open={shown} onclick={onClick}>
	<div class="scrim" data-close></div>
	<div
		class="drawer {className}"
		role="dialog"
		aria-modal="true"
		aria-label={label}
		tabindex="-1"
		bind:this={panel}
	>
		{@render children()}
	</div>
</div>
