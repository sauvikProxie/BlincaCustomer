<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import AddControl from '#lib/components/AddControl.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { getSiteData } from '#lib/stores/catalog.svelte.js';
	import { L, dishPrice, cuisineNames, restaurantUrl } from '#lib/format.js';

	/** @type {{ intentId: string }} */
	let { intentId } = $props();

	const INTENTS = [
		{ id: 'fast', icon: 'bike', kind: 'dish' },
		{ id: 'cheap', icon: 'tag', kind: 'dish' },
		{ id: 'light', icon: 'leaf', kind: 'dish' },
		{ id: 'family', icon: 'user', kind: 'rest' },
		{ id: 'spicy', icon: 'flame', kind: 'dish' },
		{ id: 'top', icon: 'star', kind: 'rest' }
	];

	const D = getSiteData();
	const listed = $derived(D.restaurants.filter((r) => r.listed || r.status === 'open'));
	const dishes = $derived.by(() => {
		/** @type {Array<{ r: any, i: any }>} */
		const out = [];
		listed.forEach((r) =>
			r.menu.forEach((c) => c.items.forEach((i) => out.push({ r, i })))
		);
		return out;
	});

	/** @param {{ id: string, kind: string }} it @returns {any[]} */
	function intentItems(it) {
		if (it.kind === 'dish') {
			return dishes.filter((x) => {
				if (it.id === 'fast') return x.r.eta <= 25;
				if (it.id === 'cheap') return x.i.price < 100;
				if (it.id === 'light')
					return (
						(x.i.tags || []).includes('vegetarian') ||
						x.r.cuisines.some((/** @type {string} */ c) => c === 'vegan' || c === 'healthy')
					);
				if (it.id === 'spicy') return (x.i.tags || []).includes('spicy');
				return true;
			});
		}
		return listed.filter((r) => {
			if (it.id === 'family')
				return (
					r.priceLevel <= 2 &&
					r.cuisines.some((c) => ['pizza', 'burgers', 'kebab'].includes(c))
				);
			if (it.id === 'top') return r.rating >= 4.5;
			return true;
		});
	}

	const it = $derived(INTENTS.find((x) => x.id === intentId));
	const items = $derived.by(() => {
		if (!it) return [];
		const list = intentItems(it);
		if (it.kind === 'dish')
			return [...list].sort(
				(a, b) => (a.r.status === 'open' ? 0 : 1) - (b.r.status === 'open' ? 0 : 1) || a.i.price - b.i.price
			);
		return list;
	});
</script>

{#if it}
	<div class="d-head">
		<h2>
			{t('h2.int.' + it.id)}<span class="count"
				>{it.kind === 'dish'
					? t('h2.dishes', { n: items.length })
					: t('h2.kitchens', { n: items.length })}</span
			>
		</h2>
		<button class="icon-btn sm" data-close aria-label={t('common.close')}
			><Icon name="x" size={18} /></button
		>
	</div>
	<div class="d-body">
		{#if it.kind === 'dish'}
			{#each items as x (`${x.r.slug}|${x.i.id}`)}
				<div class="card int-row" class:is-closed={x.r.status !== 'open'}>
					<a class="th" href={restaurantUrl(x.r.slug, x.i.id)}><Img src={x.i.image} /></a>
					<div class="grow">
						<strong>{L(x.i.name, lang())}</strong>
						<small
							>{x.r.name} · {x.r.status === 'open'
								? t('common.min', { n: x.r.eta })
								: x.r.status === 'paused'
									? t('rest.paused')
									: t('rest.closedOpens', { time: x.r.opensAt })}</small
						>
						<b>{dishPrice(x.i)}</b>
					</div>
					<div class="ctrl inline"><AddControl slug={x.r.slug} itemId={x.i.id} /></div>
				</div>
			{/each}
			{#if !items.length}<p class="muted">{t('home.emptyText')}</p>{/if}
		{:else}
			{#each items as r (r.slug)}
				<a
					class="card int-row"
					class:is-closed={r.status !== 'open'}
					href={restaurantUrl(r.slug)}
					><span class="th"><Img src={r.image} /></span><span class="grow"
						><strong>{r.name}</strong><small
							>{cuisineNames(r, lang())} · ★ {r.rating.toFixed(1)}</small
						><small
							>{r.status === 'open'
								? t('rest.openCloses', { time: r.closesAt })
								: r.status === 'paused'
									? t('rest.paused')
									: t('rest.closedOpens', { time: r.opensAt })}</small
						></span
					><Icon name="right" size={18} cls="muted-ic" /></a
				>
			{/each}
			{#if !items.length}<p class="muted">{t('home.emptyText')}</p>{/if}
		{/if}
	</div>
{/if}
