<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { isFav } from '#lib/stores/favourites.svelte.js';
	import { cuisineNames, priceLevel, restaurantUrl } from '#lib/format.js';
	import { toggleFav } from '#lib/ui.js';

	/** Big photo card for open restaurants (grid view). */
	/** @type {{ r: any }} */
	let { r } = $props();

	const fav = $derived(isFav(r.slug));
</script>

<article class="all-open-card">
	<!-- Pill and time sit inside the media box so their offsets are relative to the photo, not the whole card. -->
	<div class="all-open-media">
		<Img src={r.image} />
		<span class="all-open-pill">✓ {t('all.openPill')}</span>
		<span class="all-open-time">{t('common.minRange', { a: r.eta, b: r.eta + 10 })}</span>
	</div>
	<button
		class="icon-btn sm white all-fav"
		class:is-on={fav}
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			toggleFav(r.slug);
		}}
		aria-pressed={fav}
		aria-label={t('fav.label', { name: r.name })}><Icon name="heart" size={17} /></button
	>
	<div class="all-open-info">
		<div class="all-open-top">
			<h3><a class="all-open-link" href={restaurantUrl(r.slug)}>{r.name}</a></h3>
			{#if r.reviews > 0}
				<span class="rate"
					><Icon name="star" size={15} />{r.rating.toFixed(1)}
					<span>({r.reviews})</span></span
				>
			{/if}
		</div>
		<p class="all-open-meta">
			{cuisineNames(r, lang())} · {priceLevel(r.priceLevel)} ·
			{#if r.fee === 0}<span class="free">{t('rest.freeDelivery')}</span>{:else}{t('rest.fee', {
					n: r.fee
				})}{/if}
		</p>
	</div>
</article>
