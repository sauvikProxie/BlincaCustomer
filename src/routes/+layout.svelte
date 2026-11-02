<script lang="ts">
	// Transplant: the source app.css is the ONLY global UI stylesheet.
	import '../app.css';
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>{PUBLIC_APP_NAME}</title>
</svelte:head>

{@render children()}
