<script>
	import { closeLayer, layers } from '#lib/layers.svelte.js';

	/** @type {{ layerId: number, label?: string, className?: string, children: import('svelte').Snippet }} */
	let { layerId, label = '', className = '', children } = $props();

	let shown = $state(false);
	/** @type {HTMLElement|null} */
	let panel = $state(null);
	/** Id of the first heading, used as the dialog name when no explicit label is given. */
	let titleId = $state('');

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
			if (!label) {
				const h = panel.querySelector('h1, h2');
				if (h) {
					h.id ||= `modal-title-${layerId}`;
					titleId = h.id;
				}
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
<div class="modal-wrap" class:is-open={shown} onclick={onClick}>
	<div class="scrim" data-close></div>
	<div
		class="modal {className}"
		role="dialog"
		aria-modal="true"
		aria-label={label || undefined}
		aria-labelledby={label ? undefined : titleId || undefined}
		tabindex="-1"
		bind:this={panel}
	>
		{@render children()}
	</div>
</div>
