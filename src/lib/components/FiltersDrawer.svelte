<script>
	import Icon from '#lib/components/Icon.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { priceLevel, L, norm } from '#lib/format.js';
	import { getSiteData } from '#lib/stores/catalog.svelte.js';

	/**
	 * @type {{
	 *   initial: any,
	 *   countFor: (d: any) => number,
	 *   onApply: (d: any) => void,
	 *   close: () => void
	 * }}
	 */
	let { initial, countFor, onApply, close } = $props();

	// Snapshot on open: edits stay local until Apply.
	// svelte-ignore state_referenced_locally
	let draft = $state(JSON.parse(JSON.stringify(initial)));
	let cq = $state('');
	let expanded = $state(false);

	const D = getSiteData();
	const counts = $derived.by(() => {
		/** @type {Record<string, number>} */
		const c = {};
		D.restaurants
			.filter((r) => r.listed || r.status === 'open')
			.forEach((r) => r.cuisines.forEach((x) => (c[x] = (c[x] || 0) + 1)));
		return c;
	});
	const cuis = $derived(
		D.cuisines
			.filter((c) => counts[c.id])
			.filter((c) => {
				const q = norm(cq);
				return !q || norm(c.name.en).includes(q) || norm(c.name.sv).includes(q);
			})
	);
	const shown = $derived(expanded || cq ? cuis : cuis.slice(0, 5));
	const n = $derived(countFor(draft));

	/** @param {number[]} arr @param {number} v */
	function toggleNum(arr, v) {
		const i = arr.indexOf(v);
		if (i === -1) arr.push(v);
		else arr.splice(i, 1);
	}
	/** @param {string[]} arr @param {string} v */
	function toggleStr(arr, v) {
		const i = arr.indexOf(v);
		if (i === -1) arr.push(v);
		else arr.splice(i, 1);
	}

	function clear() {
		const s = draft.sort;
		draft = { sort: s, open: false, free: false, veg: false, time: 0, rating: 0, price: [], cuisines: [] };
	}

	function apply() {
		onApply(draft);
		close();
	}
</script>

<div class="d-head">
	<h2>{t('home.filters')}</h2>
	<button class="icon-btn sm" data-close aria-label={t('common.close')}
		><Icon name="x" size={18} /></button
	>
</div>
<div class="d-body">
	<div class="f-sec">
		<h3>{t('home.sortBy')}</h3>
		<div class="seg" role="radiogroup">
			{#each [['recommended', t('sort.recommended')], ['fastest', t('sort.fastestShort')], ['top', t('sort.top')]] as [v, label]}
				<button
					role="radio"
					aria-checked={draft.sort === v}
					class:is-on={draft.sort === v}
					onclick={() => (draft.sort = v)}>{label}</button
				>
			{/each}
		</div>
	</div>
	<div class="f-sec">
		<h3>{t('home.quick')}</h3>
		<div class="chips">
			<Chip on={draft.open} onclick={() => (draft.open = !draft.open)}
				><Icon name="clock" size={16} />{t('qf.open')}</Chip
			>
			<Chip on={draft.free} onclick={() => (draft.free = !draft.free)}
				><Icon name="tag" size={16} />{t('qf.free')}</Chip
			>
			<Chip on={draft.veg} onclick={() => (draft.veg = !draft.veg)}
				><Icon name="leaf" size={16} />{t('qf.veg')}</Chip
			>
		</div>
	</div>
	<div class="f-sec">
		<h3>{t('home.deliveryTime')}</h3>
		<div class="seg" role="radiogroup">
			{#each [[0, t('home.any')], [20, '≤ 20'], [30, '≤ 30'], [45, '≤ 45']] as [v, label]}
				<button
					role="radio"
					aria-checked={draft.time === v}
					class:is-on={draft.time === v}
					onclick={() => (draft.time = v)}>{label}</button
				>
			{/each}
		</div>
	</div>
	<div class="f-sec">
		<h3>{t('home.rating')}</h3>
		<div class="chips">
			{#each [[0, t('home.any')], [4, '4.0+'], [4.5, '4.5+']] as [v, label]}
				<Chip on={draft.rating === v} onclick={() => (draft.rating = v)}>
					{#if v}<Icon name="star" size={15} cls="filled" />{/if}{label}
				</Chip>
			{/each}
		</div>
	</div>
	<div class="f-sec">
		<h3>{t('home.price')}</h3>
		<div class="chips">
			{#each [1, 2, 3] as p}
				<Chip on={draft.price.includes(p)} onclick={() => toggleNum(draft.price, p)}
					>{priceLevel(p)}</Chip
				>
			{/each}
		</div>
	</div>
	<div class="f-sec">
		<h3>{t('home.cuisine')}</h3>
		<div class="pill-search">
			<Icon name="search" size={17} /><input
				placeholder={t('home.findCuisine')}
				aria-label={t('home.findCuisine')}
				value={cq}
				oninput={(e) => (cq = e.currentTarget.value)}
			/>
		</div>
		<div class="checks">
			{#if shown.length}
				{#each shown as c (c.id)}
					<label class="check">
						<input
							type="checkbox"
							checked={draft.cuisines.includes(c.id)}
							onchange={() => toggleStr(draft.cuisines, c.id)}
						/>
						<span class="box" class:on={draft.cuisines.includes(c.id)}
							><Icon name="check" size={13} /></span
						>{L(c.name, lang())}<span class="mo-n">{counts[c.id]}</span>
					</label>
				{/each}
			{:else}
				<p class="muted small">{t('home.noCuisine')}</p>
			{/if}
		</div>
		{#if !cq && cuis.length > 5}
			<button class="btn-link sm" onclick={() => (expanded = !expanded)}>
				{expanded ? t('home.showLess') : t('home.showMore', { n: cuis.length - 5 })}
			</button>
		{/if}
	</div>
</div>
<div class="d-foot row-foot">
	<button class="btn btn-ghost" onclick={clear}>{t('home.clearAll')}</button>
	<button class="btn btn-primary btn-lg grow" onclick={apply}>
		{n === 1 ? t('home.show1') : t('home.showN', { n })}
	</button>
</div>
