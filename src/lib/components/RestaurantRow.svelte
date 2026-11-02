<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { isFav } from '#lib/stores/favourites.svelte.js';
	import { cuisineNames, priceLevel, restaurantUrl } from '#lib/format.js';
	import { toggleFav } from '#lib/ui.js';

	/** Compact row for opening-later (and list-view open) restaurants. */
	/** @type {{ r: any }} */
	let { r } = $props();

	const fav = $derived(isFav(r.slug));
</script>

<article class="all-later-row card" class:is-open={r.status === 'open'}>
	<a class="all-later-photo" href={restaurantUrl(r.slug)} tabindex="-1" aria-hidden="true"
		><Img src={r.image} /></a
	>
	<div class="all-later-main">
		<div class="all-later-top">
			<h3><a href={restaurantUrl(r.slug)}>{r.name}</a></h3>
			{#if r.status === 'paused'}
				<span class="all-later-pill paused"><Icon name="pause" size={12} />{t('rest.pausedShort')}</span>
			{:else if r.status === 'open'}
				<span class="all-later-pill is-open">✓ {t('all.openPill')}</span>
			{:else}
				<span class="all-later-pill"
					><Icon name="clock" size={13} />{t('rest.opens', { time: r.opensAt })}</span
				>
			{/if}
			{#if r.reviews > 0}<span class="rate"><Icon name="star" size={14} />{r.rating.toFixed(1)}</span>{/if}
		</div>
		<p class="all-later-meta">{cuisineNames(r, lang())} · {priceLevel(r.priceLevel)}</p>
		<p class="all-later-meta with-ic">
			<Icon name="bike" size={14} /><span
				>{t('common.minRange', { a: r.eta, b: r.eta + 10 })} ·
				{#if r.fee === 0}<span class="free">{t('rest.freeDelivery')}</span>{:else}{t('rest.fee', {
						n: r.fee
					})}{/if}</span
			>
		</p>
	</div>
	<button
		class="icon-btn sm white"
		class:is-on={fav}
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			toggleFav(r.slug);
		}}
		aria-pressed={fav}
		aria-label={t('fav.label', { name: r.name })}><Icon name="heart" size={17} /></button
	>
</article>
