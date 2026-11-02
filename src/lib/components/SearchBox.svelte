<script>
	import { goto } from '#app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { norm, cuisine, cuisineNames, dishPrice, L, restaurantUrl } from '#lib/format.js';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { getSiteData } from '#lib/stores/catalog.svelte.js';

	/** @type {{ big?: boolean, initial?: string, autofocus?: boolean, inline?: boolean, onSearch?: ((v: string) => void) | null }} */
	let { big = false, initial = '', autofocus = false, inline = false, onSearch = null } = $props();

	// svelte-ignore state_referenced_locally (seeds the first render; the effect below follows later changes)
	let value = $state(initial);
	// The home page learns ?q= in its own onMount, after this box has mounted:
	// follow the prop so a shared /?q=pizza link lands with the term filled in.
	$effect(() => {
		value = initial;
	});
	let open = $state(false);
	/** @type {HTMLElement|null} */
	let box = $state(null);

	const q = $derived(norm(value.trim()));
	const results = $derived.by(() => {
		if (!q) return null;
		const D = getSiteData();
		const rs = D.restaurants
			.filter(
				(r) =>
					norm(r.name).includes(q) ||
					r.cuisines.some((c) => {
						const cu = cuisine(c);
						return cu && (norm(cu.name.en).includes(q) || norm(cu.name.sv).includes(q));
					})
			)
			.slice(0, 5);
		/** @type {Array<{ r: any, i: any }>} */
		const dishes = [];
		D.restaurants.forEach((r) =>
			r.menu.forEach((c) =>
				c.items.forEach((i) => {
					if (norm(i.name.en).includes(q) || norm(i.name.sv).includes(q))
						dishes.push({ r, i });
				})
			)
		);
		return { rs, dishes: dishes.slice(0, 6) };
	});

	$effect(() => {
		if (!open) return;
		/** @param {MouseEvent} e */
		const onDoc = (e) => {
			if (box && e.target instanceof Node && !box.contains(e.target)) open = false;
		};
		document.addEventListener('click', onDoc);
		return () => document.removeEventListener('click', onDoc);
	});

	function submit() {
		const v = value.trim();
		open = false;
		if (onSearch) onSearch(v);
		else goto(v ? `/?q=${encodeURIComponent(v)}#all-restaurants` : '/#all-restaurants');
	}
</script>

<div
	class="search"
	class:big-search={big}
	role="search"
	aria-label={big ? t('header.search') : t('nav.search')}
	bind:this={box}
>
	<Icon name="search" size={big ? 21 : 18} cls="search-ic" />
	<!-- svelte-ignore a11y_autofocus (dialog/form: focus moves on open, as intended) -->
	<input
		type="search"
		class="search-input"
		autocomplete="off"
		placeholder={t('header.search')}
		aria-label={t('header.search')}
		bind:value
		{autofocus}
		oninput={() => (open = true)}
		onfocus={() => {
			if (value.trim()) open = true;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				submit();
			}
			if (e.key === 'Escape') {
				open = false;
				e.currentTarget.blur();
			}
		}}
	/>
	{#if big}
		<button class="btn btn-primary" onclick={submit}>{t('nav.search')}</button>
	{/if}
	<div class="search-results" class:inline hidden={!open || !results}>
		{#if results}
			{#if results.rs.length}
				<div class="sr-group">{t('search.restaurants')}</div>
				{#each results.rs as r (r.slug)}
					<a class="sr-row" href={restaurantUrl(r.slug)}
						><span class="sr-th"><Img src={r.image} /></span><span
							><strong>{r.name}</strong><small>{cuisineNames(r, lang())}</small></span
						></a
					>
				{/each}
			{/if}
			{#if results.dishes.length}
				<div class="sr-group">{t('search.dishes')}</div>
				{#each results.dishes as d (`${d.r.slug}|${d.i.id}`)}
					<a class="sr-row" href={restaurantUrl(d.r.slug, d.i.id)}
						><span class="sr-th"><Img src={d.i.image} /></span><span
							><strong>{L(d.i.name, lang())}</strong><small
								>{d.r.name} · {dishPrice(d.i)}</small
							></span
						></a
					>
				{/each}
			{/if}
			{#if !results.rs.length && !results.dishes.length}
				<div class="sr-empty">{t('search.none', { q: value.trim() })}</div>
			{/if}
		{/if}
	</div>
</div>
