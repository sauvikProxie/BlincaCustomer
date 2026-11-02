<script>
	import { layers } from '#lib/layers.svelte.js';
	import Drawer from '#lib/components/Drawer.svelte';
	import Modal from '#lib/components/Modal.svelte';
</script>

{#each layers as layer (layer.id)}
	{@const Layer = layer.component}
	{#if layer.kind === 'drawer'}
		<Drawer layerId={layer.id} side={layer.side} label={layer.label} className={layer.className}>
			<Layer {...layer.props} />
		</Drawer>
	{:else}
		<Modal layerId={layer.id} label={layer.label} className={layer.className}>
			<Layer {...layer.props} />
		</Modal>
	{/if}
{/each}
