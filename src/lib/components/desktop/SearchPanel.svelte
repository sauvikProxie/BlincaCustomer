<script>
	import { goto } from '#app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { getSiteData, item } from '#lib/stores/catalog.svelte.js';
	import { read, write } from '#lib/stores/core.svelte.js';
	import { norm, L, dishPrice, cuisineNames, restaurantUrl } from '#lib/format.js';

	/**
	 * @type {{
	 *   query?: string,
	 *   setQuery: (v: string) => void,
	 *   close: () => void,
	 *   activeId?: string
	 * }}
	 */
	let { query = '', setQuery, close, activeId = $bindable('') } = $props();

	const q = $derived(norm(query.trim()));

	/* ---- recent searches (localStorage blinca.v1.recentSearches via core read/write) ---- */
	/** @returns {string[]} */
	function recent() {
		return read('recentSearches', []);
	}
	/** @param {string} term */
	function addRecent(term) {
		term = (term || '').trim();
		if (!term) return;
		const low = term.toLowerCase();
		const list = recent().filter((/** @type {string} */ r) => r.toLowerCase() !== low);
		list.unshift(term);
		write('recentSearches', list.slice(0, 6));
	}
	/** @param {string} term */
	function removeRecent(term) {
		const low = term.toLowerCase();
		write(
			'recentSearches',
			recent().filter((/** @type {string} */ r) => r.toLowerCase() !== low)
		);
	}
	function clearRecent() {
		write('recentSearches', []);
	}

	/* ---- popular ---- */
	const popularNow = $derived.by(() => {
		/** @type {string[]} */
		const dishes = [];
		for (const [slug, itemId] of (getSiteData().trending || []).slice(0, 4)) {
			const it = item(slug, itemId);
			if (it) dishes.push(L(it.name, lang()));
		}
		return [...new Set([...dishes, t('search.quickVegan'), t('search.quickTop')])];
	});
	const popularRests = $derived(
		getSiteData()
			.restaurants.filter((r) => r.status === 'open')
			.slice(0, 3)
	);

	/* ---- live results ---- */
	const results = $derived.by(() => {
		if (!q) return null;
		const D = getSiteData();
		const rs = D.restaurants
			.filter(
				(r) =>
					norm(r.name).includes(q) ||
					norm(cuisineNames(r, 'en')).includes(q) ||
					norm(cuisineNames(r, 'sv')).includes(q)
			)
			.slice(0, 4);
		/** @type {Array<{ r: any, i: any }>} */
		const dishes = [];
		D.restaurants.forEach((r) =>
			r.menu.forEach((c) =>
				c.items.forEach((i) => {
					if (norm(i.name.en).includes(q) || norm(i.name.sv).includes(q)) dishes.push({ r, i });
				})
			)
		);
		return { rs, dishes: dishes.slice(0, 4) };
	});

	/* flat navigable list for keyboard + mouse */
	const navItems = $derived.by(() => {
		if (!results) return [];
		/** @type {Array<{ label: string, href: string }>} */
		const out = [];
		results.rs.forEach((r) => out.push({ label: r.name, href: restaurantUrl(r.slug) }));
		results.dishes.forEach((d) =>
			out.push({ label: L(d.i.name, lang()), href: restaurantUrl(d.r.slug, d.i.id) })
		);
		return out;
	});

	let hi = $state(-1);
	/* reset highlight whenever the query changes */
	$effect(() => {
		void q;
		hi = -1;
	});
	$effect(() => {
		activeId = hi >= 0 ? `sp-opt-${hi}` : '';
	});

	/** @param {{ label: string, href: string }} it */
	function openItem(it) {
		addRecent(it.label);
		close();
		goto(it.href);
	}
	function submitFull() {
		const v = query.trim();
		if (v) addRecent(v);
		close();
		goto(v ? `/?q=${encodeURIComponent(v)}#all-restaurants` : '/#all-restaurants');
	}

	/** Called by DesktopHeader from the input's keydown. @param {KeyboardEvent} e @returns {boolean} handled */
	export function handleKey(e) {
		const list = navItems;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			hi = list.length ? Math.min(hi + 1, list.length - 1) : -1;
			return true;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			hi = Math.max(hi - 1, -1);
			return true;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			if (hi >= 0 && list[hi]) openItem(list[hi]);
			else submitFull();
			return true;
		}
		return false;
	}

	/** bold the matched letters. @param {string} text */
	function segments(text) {
		const ql = query.trim().toLowerCase();
		if (!ql) return [{ s: text, hit: false }];
		const i = text.toLowerCase().indexOf(ql);
		if (i < 0) return [{ s: text, hit: false }];
		return [
			{ s: text.slice(0, i), hit: false },
			{ s: text.slice(i, i + ql.length), hit: true },
			{ s: text.slice(i + ql.length), hit: false }
		].filter((seg) => seg.s);
	}

	/** @param {any} r */
	const restSub = (r) =>
		`${cuisineNames(r, lang())} · ${r.status === 'open' ? t('search.open') : t('search.opensAt', { t: r.opensAt })}`;

	const hasResults = $derived(!!results && (results.rs.length > 0 || results.dishes.length > 0));
	const recentList = $derived(recent());
</script>

<div class="sp" class:has-query={!!q} aria-label={t('nav.search')} tabindex="-1">
	<!-- LEFT column -->
	<div class="col col-main">
		{#if q}
			{#if hasResults}
				<div role="listbox" aria-label={t('nav.search')}>
				{#if results?.rs.length}
					<div role="group" aria-label={t('search.restaurants')}>
					<div class="sp-group" aria-hidden="true">{t('search.restaurants')}</div>
					{#each results.rs as r, idx (r.slug)}
						<button
							type="button"
							id={`sp-opt-${idx}`}
							role="option"
							aria-selected={hi === idx}
							class="sp-row"
							class:hl={hi === idx}
							onmousemove={() => (hi = idx)}
							onclick={() => openItem({ label: r.name, href: restaurantUrl(r.slug) })}
						>
							<span class="th"><Img src={r.image} /></span>
							<span class="meta">
								<strong>{#each segments(r.name) as seg}{#if seg.hit}<b>{seg.s}</b>{:else}{seg.s}{/if}{/each}</strong>
								<small>{restSub(r)}</small>
							</span>
						</button>
					{/each}
					</div>
				{/if}
				{#if results?.dishes.length}
					{@const base = results.rs.length}
					<div role="group" aria-label={t('search.dishes')}>
					<div class="sp-group" aria-hidden="true">{t('search.dishes')}</div>
					{#each results.dishes as d, j (`${d.r.slug}|${d.i.id}`)}
						{@const idx = base + j}
						<button
							type="button"
							id={`sp-opt-${idx}`}
							role="option"
							aria-selected={hi === idx}
							class="sp-row"
							class:hl={hi === idx}
							onmousemove={() => (hi = idx)}
							onclick={() => openItem({ label: L(d.i.name, lang()), href: restaurantUrl(d.r.slug, d.i.id) })}
						>
							<span class="th"><Img src={d.i.image} /></span>
							<span class="meta">
								<strong>{#each segments(L(d.i.name, lang())) as seg}{#if seg.hit}<b>{seg.s}</b>{:else}{seg.s}{/if}{/each}</strong>
								<small>{d.r.name} · {dishPrice(d.i)}</small>
							</span>
						</button>
					{/each}
					</div>
				{/if}
				</div>
			{:else}
				<div class="sp-empty">{t('search.none', { q: query.trim() })}</div>
				<div class="sp-group">{t('search.popularNow')}</div>
				<div class="chips">
					{#each popularNow as term (term)}
						<button type="button" class="chip" onclick={() => setQuery(term)}>{term}</button>
					{/each}
				</div>
			{/if}
		{:else if recentList.length}
			<div class="sp-group spread">
				<span>{t('search.recent')}</span>
				<button type="button" class="link" onclick={clearRecent}>{t('search.clear')}</button>
			</div>
			<div class="chips">
				{#each recentList as term (term)}
					<span class="chip recent">
						<button type="button" class="chip-main" onclick={() => setQuery(term)}>
							<Icon name="clock" size={15} />{term}
						</button>
						<button
							type="button"
							class="chip-x"
							aria-label={t('search.remove', { q: term })}
							onclick={() => removeRecent(term)}><Icon name="x" size={13} /></button
						>
					</span>
				{/each}
			</div>
		{:else}
			<div class="sp-group">{t('search.popularRest')}</div>
			{#each popularRests as r (r.slug)}
				<button type="button" class="sp-row" onclick={() => openItem({ label: r.name, href: restaurantUrl(r.slug) })}>
					<span class="th"><Img src={r.image} /></span>
					<span class="meta"><strong>{r.name}</strong><small>{restSub(r)}</small></span>
				</button>
			{/each}
		{/if}
	</div>

	<!-- RIGHT column -->
	<div class="col col-side">
		{#if q && recentList.length}
			<div class="sp-group">{t('search.recent')}</div>
			<div class="chips">
				{#each recentList as term (term)}
					<button type="button" class="chip" onclick={() => setQuery(term)}><Icon name="clock" size={15} />{term}</button>
				{/each}
			</div>
		{/if}
		<div class="sp-group">{t('search.popularNow')}</div>
		<div class="chips">
			{#each popularNow as term, i (term)}
				<button type="button" class="chip" onclick={() => setQuery(term)}>
					<Icon name={i === 0 ? 'flame' : i === 1 ? 'leaf' : 'star'} size={15} cls="pc-ic" />{term}
				</button>
			{/each}
		</div>
	</div>

	{#if q}
		<button type="button" class="sp-seeall" onclick={submitFull}>
			{t('search.seeAll', { q: query.trim() })} <Icon name="arrow" size={16} />
		</button>
	{/if}
</div>

<style>
	.sp {
		position: absolute;
		top: calc(100% + 10px);
		left: 0;
		width: 680px;
		max-width: calc(100vw - 40px);
		z-index: 90;
		display: grid;
		grid-template-columns: 1fr 240px;
		gap: 10px 18px;
		padding: 14px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		box-shadow: 0 20px 56px rgba(60, 20, 20, 0.18);
	}
	.col {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.col-side {
		border-left: 1px solid var(--border);
		padding-left: 18px;
	}
	.sp-group {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
		padding: 8px 6px 6px;
	}
	.sp-group.spread {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.link {
		font-size: 13px;
		font-weight: 600;
		color: var(--brand-dark);
		text-transform: none;
		letter-spacing: 0;
	}
	.link:hover {
		color: var(--brand-hover);
		text-decoration: underline;
	}
	.sp-row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 8px;
		border-radius: 12px;
		text-align: left;
	}
	.sp-row.hl,
	.sp-row:hover {
		background: var(--bg);
	}
	.th {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		overflow: hidden;
		flex: none;
		background: var(--soft);
	}
	.th :global(img),
	.th :global(.ph) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.meta strong {
		font-size: 14.5px;
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta strong b {
		font-weight: 800;
	}
	.meta small {
		font-size: 12.5px;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sp-empty {
		padding: 14px 6px;
		font-size: 14px;
		color: var(--text-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 2px 4px 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 34px;
		padding: 0 12px;
		border-radius: 999px;
		background: var(--field);
		border: 1px solid transparent;
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text);
	}
	.chip:hover {
		border-color: var(--border-strong);
	}
	.chip :global(.pc-ic) {
		color: var(--brand);
	}
	.chip.recent {
		padding: 0 4px 0 12px;
		gap: 2px;
	}
	.chip-main {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 34px;
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text);
	}
	.chip-x {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		color: var(--muted);
		opacity: 0;
		transition: opacity 0.12s;
	}
	.chip.recent:hover .chip-x {
		opacity: 1;
	}
	.chip-x:hover {
		background: var(--soft);
		color: var(--brand);
	}
	.sp-seeall {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-top: 2px;
		padding: 12px;
		border-top: 1px solid var(--border);
		font-size: 14px;
		font-weight: 600;
		color: var(--brand-dark);
	}
	.sp-seeall:hover {
		color: var(--brand-hover);
	}

	/* Tablet: single column — results first, then recent + popular. */
	@media (max-width: 1080px) {
		.sp {
			width: 100%;
			min-width: 520px;
			grid-template-columns: 1fr;
		}
		.col-side {
			border-left: 0;
			padding-left: 0;
			border-top: 1px solid var(--border);
			padding-top: 4px;
		}
	}
</style>
