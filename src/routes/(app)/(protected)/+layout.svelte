<script>
	// Transplant: the chrome + engines live in (app)/+layout.svelte; this group
	// only carries the server-side auth guard (+layout.server.ts). Pass through.
	/** @type {{ children: import('svelte').Snippet }} */
	let { children } = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

{@render children()}
