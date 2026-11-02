<script>
	import { ICON_PATHS } from '#lib/icons.js';

	/** @type {{ name: string, size?: number, cls?: string }} */
	let { name, size = 20, cls = '' } = $props();
</script>

<svg
	class="ic {cls}"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false">{@html ICON_PATHS[name] ?? ''}</svg>
