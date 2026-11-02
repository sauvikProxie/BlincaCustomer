<script>
	import Icon from '#lib/components/Icon.svelte';
	import Stepper from '#lib/components/Stepper.svelte';
	import { item, restaurant } from '#lib/stores/catalog.svelte.js';
	import { itemQty } from '#lib/stores/cart.svelte.js';
	import { L } from '#lib/format.js';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { requestAdd, decItem } from '#lib/ui.js';
	import { itemUnavailable } from '#lib/itemAvailability.js';

	/** Add-to-cart control: + button, or stepper once items are in the cart. */
	/** @type {{ slug: string, itemId: string }} */
	let { slug, itemId } = $props();

	const it = $derived(item(slug, itemId));
	const rest = $derived(it ? restaurant(slug) : null);
	const qty = $derived(itemQty(slug, itemId));
	const name = $derived(it ? L(it.name, lang()) : '');
	// Closed restaurant or sold-out / out-of-schedule dish: nothing can be added.
	const closed = $derived(
		!rest || rest.status !== 'open' || !!(it && itemUnavailable(it.availability, lang()))
	);
</script>

{#if it && rest}
	{#if qty > 0}
		<Stepper
			{qty}
			decLabel={t('qty.less', { name })}
			incLabel={t('qty.more', { name })}
			disabledInc={closed}
			onDec={() => decItem(slug, itemId)}
			onInc={() => requestAdd(slug, itemId)}
		/>
	{:else}
		<button
			class="add-round"
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				requestAdd(slug, itemId);
			}}
			aria-label={t('qty.add', { name })}
			disabled={closed}><Icon name="plus" size={18} /></button
		>
	{/if}
{/if}
