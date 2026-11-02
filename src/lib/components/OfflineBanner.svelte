<script>
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	let online = $state(true);

	onMount(() => {
		const sync = () => (online = navigator.onLine);
		sync();
		window.addEventListener('online', sync);
		window.addEventListener('offline', sync);
		return () => {
			window.removeEventListener('online', sync);
			window.removeEventListener('offline', sync);
		};
	});
</script>

<!-- In flow (not fixed) so it never covers the header or tab bar. -->
{#if !online}
	<p class="offline" role="status">{m.offline_banner()}</p>
{/if}

<style>
	.offline {
		margin: 0;
		padding: 10px 16px;
		text-align: center;
		font-size: 14px;
		font-weight: 600;
		background: var(--dark);
		color: #fff;
	}
</style>
