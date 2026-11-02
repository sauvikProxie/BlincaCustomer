<script>
	/* Glyphs from home2.js (grid/list view switch, back-to-top arrow).
	   Same rule as Icon.svelte: static trusted path data only. */
	const PATHS = {
		grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
		list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
		up: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'
	};

	/** @type {{ name: 'grid' | 'list' | 'up', size?: number }} */
	let { name, size = 18 } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false">{@html PATHS[name]}</svg
>
