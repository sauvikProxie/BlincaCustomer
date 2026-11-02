<script>
	import { onMount } from 'svelte';
	import { page } from '#app/state';
	import Icon from '#lib/components/Icon.svelte';
	import Plate from '#lib/components/Plate.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { m } from '#lib/paraglide/messages.js';

	let el = $state(/** @type {HTMLElement | null} */ (null));
	// Rendered by the root layout (unknown URL) there is no <main>; inside the app layout there is one.
	let bare = $state(false);
	onMount(() => (bare = !el?.closest('main')));

	const notFound = $derived(page.status === 404);

	/* Legacy .html URLs land here on static hosting (fallback 404.html);
	   redirect them to the new routes client-side. */
	const LEGACY_INFO = ['about', 'how', 'help', 'contact', 'terms', 'privacy', 'account'];

	$effect(() => {
		const path = page.url.pathname;
		if (path === '/restaurant.html') {
			const slug = page.url.searchParams.get('slug');
			window.location.replace(slug ? `/restaurants/${encodeURIComponent(slug)}${page.url.hash}` : '/');
		} else if (path === '/info.html') {
			const p = page.url.searchParams.get('page');
			const tab = page.url.searchParams.get('tab');
			if (p === 'account') window.location.replace(`/account${tab ? `?tab=${tab}` : ''}`);
			else if (p && LEGACY_INFO.includes(p)) window.location.replace(`/info/${p}`);
			else window.location.replace('/info/about');
		} else if (path === '/checkout.html') window.location.replace('/checkout');
		else if (path === '/login.html') {
			const next = page.url.searchParams.get('next');
			const mode = page.url.searchParams.get('mode');
			const q = new URLSearchParams();
			if (next) q.set('next', next);
			if (mode) q.set('mode', mode);
			const qs = q.toString();
			window.location.replace(`/login${qs ? `?${qs}` : ''}`);
		} else if (path === '/index.html') {
			window.location.replace(`/${page.url.search}${page.url.hash}`);
		}
	});
</script>

<svelte:head>
	<title>{notFound ? t('nf.title') : m.servererror_heading()} – Blinca</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="center-card" bind:this={el} role={bare ? 'main' : undefined}>
	<div class="card auth-card nf">
		<span class="nf-ic"><Plate /></span>
		{#if notFound}
			<p class="nf-code">404</p>
			<h1 class="h2">{t('nf.heading')}</h1>
			<p class="muted">{t('nf.text')}</p>
			<div class="nf-actions">
				<a class="btn btn-primary btn-lg" href="/">{t('nf.home')}</a>
				<a class="btn btn-secondary btn-lg" href="/#all-restaurants">{t('cart.browse')}</a>
			</div>
		{:else}
			<p class="nf-code">{m.error_status_label({ status: page.status })}</p>
			<h1 class="h2">{m.servererror_heading()}</h1>
			<p class="muted">{m.servererror_body()}</p>
			<div class="nf-actions">
				<button class="btn btn-primary btn-lg" onclick={() => window.location.reload()}
					>{m.error_retry()}</button
				>
				<a class="btn btn-secondary btn-lg" href="/">{t('nf.home')}</a>
			</div>
		{/if}
	</div>
</div>
