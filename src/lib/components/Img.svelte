<script>
	import Plate from '#lib/components/Plate.svelte';

	/** @type {{ src?: string | null, alt?: string }} */
	let { src, alt = '' } = $props();

	let failed = $state(false);
</script>

{#if src && !failed}
	<img
		class="cover"
		src={src}
		alt={alt}
		loading="lazy"
		decoding="async"
		onerror={() => (failed = true)}
	/>
{:else}
	<div class="ph"><Plate /></div>
{/if}
