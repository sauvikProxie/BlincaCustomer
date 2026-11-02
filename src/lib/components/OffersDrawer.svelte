<script>
	import Icon from '#lib/components/Icon.svelte';
	import OfferCard from '#lib/components/OfferCard.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { copyCode } from '#lib/ui.js';
	import { setPromoDraft } from '#lib/stores/promo.svelte.js';
	import { activeOffers, isNew, markOpened, offerKey } from '#lib/stores/offers.svelte.js';

	const offers = $derived(
		[...activeOffers()].sort((a, b) => (isNew(b) ? 1 : 0) - (isNew(a) ? 1 : 0))
	);

	/** @param {any} o */
	function copy(o) {
		if (o.code) {
			copyCode(o.code, t('offer.copied', { code: o.code }));
			setPromoDraft(o.code);
		}
		markOpened(offerKey(o));
	}
</script>

<div class="d-head">
	<h2>{t('home.offers')}<span class="count">{offers.length}</span></h2>
	<button class="icon-btn sm" data-close aria-label={t('common.close')}
		><Icon name="x" size={18} /></button
	>
</div>
<div class="d-body">
	{#each offers as o (offerKey(o))}
		<button class="offer theme-{o.theme}" class:is-new={isNew(o)} onclick={() => copy(o)}>
			{#if isNew(o)}<span class="offer-new-pill"><span class="dot"></span>{t('offer.new')}</span>{/if}
			<OfferCard offer={o} />
		</button>
	{/each}
	<p class="muted small">{t('offer.hint')}</p>
</div>
