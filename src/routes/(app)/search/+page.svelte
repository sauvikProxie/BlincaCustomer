<script>
	import { browser } from '#app/env';
	import { goto } from '#app/navigation';
	import { page } from '#app/state';
	import { useQuery } from 'convex-svelte';
	import { api } from '@blinca/backend/convex/_generated/api';
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { norm, cuisine, cuisineNames, L, restaurantUrl } from '#lib/format.js';
	import { getSiteData } from '#lib/stores/catalog.svelte.js';
	import { formatMoney } from '#lib/money.js';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { m } from '#lib/paraglide/messages.js';

	// The backend ignores queries under 2 characters; mirror that so we never ask.
	const MIN = 2;
	const q = $derived((page.url.searchParams.get('q') ?? '').trim());
	let value = $state('');
	$effect(() => {
		value = q;
	});

	const res = browser
		? useQuery(api.customer.menu.searchDishes, () => (q.length >= MIN ? { query: q } : 'skip'))
		: null;
	const groups = $derived(res?.data?.restaurants ?? []);

	// Restaurants match on the loaded catalog (name or cuisine), the same way the header search panel does.
	const restaurantHits = $derived.by(() => {
		if (q.length < MIN) return [];
		const needle = norm(q);
		return getSiteData()
			.restaurants.filter(
				(r) =>
					norm(r.name).includes(needle) ||
					r.cuisines.some((c) => {
						const cu = cuisine(c);
						return cu && (norm(cu.name.en).includes(needle) || norm(cu.name.sv).includes(needle));
					})
			)
			.slice(0, 8);
	});

	// Echo what was searched, so the page still makes sense after the field is edited.
	const heading = $derived(q.length >= MIN ? t('search.resultsFor', { q }) : t('search.dishes'));

	function submit() {
		const v = value.trim();
		goto(v ? `/search?q=${encodeURIComponent(v)}` : '/search', { keepFocus: true });
	}
</script>

<svelte:head>
	<title>{heading} – Blinca</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="wrap narrow search-page">
	<h1 class="h1">{heading}</h1>
	<form
		class="search big-search"
		role="search"
		aria-label={t('nav.search')}
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<Icon name="search" size={21} cls="search-ic" />
		<input
			type="search"
			class="search-input"
			autocomplete="off"
			placeholder={t('header.search')}
			aria-label={t('header.search')}
			bind:value
		/>
		<button class="btn btn-primary" type="submit">{t('nav.search')}</button>
	</form>

	<!-- min-height: results arriving must not push the footer down (CLS) -->
	<div class="search-body" aria-live="polite">
		{#if q.length >= MIN}
			{#if restaurantHits.length}
				<section class="card sr-card">
					<div class="sr-group">{t('search.restaurants')}</div>
					{#each restaurantHits as r (r.slug)}
						<a class="sr-row" href={restaurantUrl(r.slug)}
							><span class="sr-th"><Img src={r.image} /></span><span
								><strong>{r.name}</strong><small>{cuisineNames(r, lang())}</small></span
							></a
						>
					{/each}
				</section>
			{/if}
			{#if res?.error}
				<div class="empty" role="alert">
					<p>{m.error_body()}</p>
					<button type="button" class="btn btn-secondary" onclick={() => location.reload()}
						>{m.error_retry()}</button
					>
				</div>
			{:else if res?.isLoading && !res?.data}
				<section class="card sr-card" role="status" aria-label={m.loading()}>
					{#each [0, 1, 2, 3] as n (n)}
						<div class="sr-skel"><i></i><i></i></div>
					{/each}
				</section>
			{:else if res?.data}
				{#each groups as g (g.restaurantId)}
					<section class="card sr-card">
						<a class="sr-group" href={restaurantUrl(g.slug)}
							>{g.name}<Icon name="arrow" size={16} /></a
						>
						{#each g.dishes as d (d.itemId)}
							<a class="sr-row" href={restaurantUrl(g.slug, d.itemId)}
								><span class="sr-th"><Img src={d.imageUrl} /></span><span
									><strong>{L({ sv: d.name, en: d.nameEn ?? d.name }, lang())}</strong><small
										>{formatMoney(d.priceCents)}</small
									></span
								></a
							>
						{/each}
					</section>
				{/each}
				{#if !groups.length && !restaurantHits.length}
					<div class="empty"><p>{t('search.none', { q })}</p></div>
				{/if}
			{/if}
		{:else}
			<p class="muted">{m.search_min_hint()}</p>
		{/if}
	</div>
</div>
