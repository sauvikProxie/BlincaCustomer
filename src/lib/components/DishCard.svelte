<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import AddControl from '#lib/components/AddControl.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { itemQty } from '#lib/stores/cart.svelte.js';
	import { L, dishPrice, restaurantUrl } from '#lib/format.js';
	import { requestAdd } from '#lib/ui.js';
	import { itemUnavailable } from '#lib/itemAvailability.js';

	/**
	 * Dish card: `variant="popular"` (restaurant Popular grid) or
	 * `variant="menu"` (menu list row). Legacy classes preserved.
	 * @type {{ slug: string, item: any, popular?: boolean, rank?: number }}
	 */
	let { slug, item: it, popular = false, rank = 0 } = $props();

	const qty = $derived(itemQty(slug, it.id));
	const name = $derived(L(it.name, lang()));
	const unavailable = $derived(itemUnavailable(it.availability, lang()));

	function open() {
		requestAdd(slug, it.id);
	}
</script>

{#if popular}
	<article class="card pcard" class:in-cart={qty > 0} class:is-sold={!!unavailable} id="pop-{it.id}">
		<div class="media">
			<button class="media-btn" onclick={open} aria-label={name}><Img src={it.image} /></button>
			{#if rank}<span class="rank">{t('rest.mostOrdered', { n: rank })}</span>{/if}
			<div class="ctrl"><AddControl {slug} itemId={it.id} /></div>
		</div>
		<div class="pc-body">
			<h3><button onclick={open}>{name}</button></h3>
			<p class="price">{dishPrice(it)}</p>
			{#if unavailable}<span class="tag sold" data-testid="sold-out">{unavailable}</span>{/if}
		</div>
	</article>
{:else}
	<article class="card mi" class:in-cart={qty > 0} class:is-sold={!!unavailable} id="item-{it.id}">
		{#if qty}<span class="incart">{t('rest.inCart', { n: qty })}</span>{/if}
		<div class="mi-text">
			<h3><button onclick={open}>{name}</button></h3>
			<p>{L(it.desc, lang())}</p>
			<div class="mi-ft">
				<b>{dishPrice(it)}</b>
				{#if unavailable}<span class="tag sold" data-testid="sold-out">{unavailable}</span>{/if}
				{#if (it.tags || []).includes('vegetarian')}
					<span class="tag veg"><Icon name="leaf" size={13} />{t('tag.vegetarian')}</span>
				{/if}
				{#if (it.tags || []).includes('spicy')}
					<span class="tag hot"><Icon name="flame" size={13} />{t('tag.spicy')}</span>
				{/if}
			</div>
		</div>
		<div class="media">
			<button class="media-btn" onclick={open} tabindex="-1" aria-hidden="true"
				><Img src={it.image} /></button
			>
			<div class="ctrl"><AddControl {slug} itemId={it.id} /></div>
		</div>
	</article>
{/if}
