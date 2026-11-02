<script>
	import Icon from '#lib/components/Icon.svelte';
	import Glyph from '#lib/components/Glyph.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { priceLevel, L } from '#lib/format.js';

	/**
	 * @type {{
	 *   f: any,
	 *   activeCount: number, view: string, openPop: string | null,
	 *   cuisineCounts: Record<string, number>, allCuisines: Array<{ id: string, name: any }>,
	 *   onOpenFilters: () => void, onPop: (id: string) => void,
	 *   onSort: (s: string) => void, onPrice: (p: number) => void, onCuisine: (c: string) => void,
	 *   onToggle: (k: string) => void, onView: (v: string) => void
	 * }}
	 */
	let {
		f,
		activeCount,
		view,
		openPop,
		cuisineCounts,
		allCuisines,
		onOpenFilters,
		onPop,
		onSort,
		onPrice,
		onCuisine,
		onToggle,
		onView
	} = $props();

	const sortLabel = $derived(t('home.sortLabel', { s: t('sort.' + f.sort) }));
	const priceLabel = $derived(
		f.price.length ? [...f.price].sort().map(priceLevel).join(', ') : t('home.price')
	);
	const cuisLabel = $derived(
		f.cuisines.length ? t('home.cuisine') + ' · ' + f.cuisines.length : t('home.cuisine')
	);

	/**
	 * Dropdowns open under their chip, which can sit near either viewport edge once the row
	 * wraps: shift an open one horizontally back inside the window.
	 * @param {boolean} open
	 */
	const keepInView = (open) => (/** @type {HTMLElement} */ el) => {
		if (!open) return;
		const raf = requestAnimationFrame(() => {
			el.style.translate = '';
			const { left, right } = el.getBoundingClientRect();
			const gutter = 16;
			const dx = Math.max(gutter - left, Math.min(0, innerWidth - gutter - right));
			if (dx) el.style.translate = `${dx}px 0`;
		});
		return () => cancelAnimationFrame(raf);
	};
</script>

<div class="all-filterbar-row">
	<Chip on={activeCount > 0} onclick={onOpenFilters}>
		<Icon name="sliders" size={16} />{t('home.allFilters')}
		{#if activeCount}<span class="n">{activeCount}</span>{/if}
	</Chip>

	<div class="bar-pop">
		<Chip
			on={f.sort !== 'recommended'}
			expanded={openPop === 'sort'}
			onclick={() => onPop('sort')}
		>
			<Icon name="sort" size={16} />{sortLabel}<Icon name="down" size={15} />
		</Chip>
		<div
			class="menu bar-menu"
			role="menu"
			hidden={openPop !== 'sort'}
			{@attach keepInView(openPop === 'sort')}
		>
			{#each ['recommended', 'fastest', 'top'] as s}
				<button
					class="menu-opt"
					role="menuitemradio"
					aria-checked={f.sort === s}
					onclick={(e) => {
						e.stopPropagation();
						onSort(s);
					}}><span class="rdot" class:on={f.sort === s}></span>{t('sort.' + s)}</button
				>
			{/each}
		</div>
	</div>

	<span class="sep" aria-hidden="true"></span>

	<Chip on={f.open} onclick={() => onToggle('open')}><Icon name="clock" size={16} />{t('qf.open')}</Chip>
	<Chip on={f.time === 30} onclick={() => onToggle('fast')}
		><Icon name="bike" size={16} />{t('qf.fast')}</Chip
	>
	<Chip on={f.free} onclick={() => onToggle('free')}><Icon name="tag" size={16} />{t('qf.free')}</Chip>
	<Chip on={f.rating === 4.5} onclick={() => onToggle('top')}
		><Icon name="star" size={16} cls="filled" />{t('qf.top')}</Chip
	>
	<Chip on={f.veg} onclick={() => onToggle('veg')}><Icon name="leaf" size={16} />{t('qf.veg')}</Chip>

	<div class="bar-pop">
		<Chip on={f.price.length > 0} expanded={openPop === 'price'} onclick={() => onPop('price')}>
			{priceLabel}<Icon name="down" size={15} />
		</Chip>
		<div
			class="menu bar-menu"
			role="menu"
			hidden={openPop !== 'price'}
			{@attach keepInView(openPop === 'price')}
		>
			{#each [1, 2, 3] as p}
				<button
					class="menu-opt"
					role="menuitemcheckbox"
					aria-checked={f.price.includes(p)}
					onclick={(e) => {
						e.stopPropagation();
						onPrice(p);
					}}
					><span class="box" class:on={f.price.includes(p)}><Icon name="check" size={13} /></span
					>{priceLevel(p)}</button
				>
			{/each}
		</div>
	</div>

	<div class="bar-pop">
		<Chip
			on={f.cuisines.length > 0}
			expanded={openPop === 'cuisine'}
			onclick={() => onPop('cuisine')}
		>
			{cuisLabel}<Icon name="down" size={15} />
		</Chip>
		<div
			class="menu bar-menu"
			role="menu"
			hidden={openPop !== 'cuisine'}
			{@attach keepInView(openPop === 'cuisine')}
		>
			{#each allCuisines.filter((c) => cuisineCounts[c.id]) as c (c.id)}
				<button
					class="menu-opt"
					role="menuitemcheckbox"
					aria-checked={f.cuisines.includes(c.id)}
					onclick={(e) => {
						e.stopPropagation();
						onCuisine(c.id);
					}}
					><span class="box" class:on={f.cuisines.includes(c.id)}
						><Icon name="check" size={13} /></span
					>{L(c.name, lang())}<span class="mo-n">{cuisineCounts[c.id]}</span></button
				>
			{/each}
		</div>
	</div>

	<div class="all-view" role="group" aria-label={t('all.viewLabel')}>
		<button
			data-view="grid"
			class:is-on={view === 'grid'}
			aria-pressed={view === 'grid'}
			aria-label={t('all.gridView')}
			onclick={() => onView('grid')}><Glyph name="grid" /></button
		>
		<button
			data-view="list"
			class:is-on={view === 'list'}
			aria-pressed={view === 'list'}
			aria-label={t('all.listView')}
			onclick={() => onView('list')}><Glyph name="list" /></button
		>
	</div>
</div>
