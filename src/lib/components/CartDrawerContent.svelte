<script>
	import { goto } from '#app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import Stepper from '#lib/components/Stepper.svelte';
	import PromoBox from '#lib/components/PromoBox.svelte';
	import Totals from '#lib/components/Totals.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import {
		cart,
		cartRestaurant,
		count,
		lineTotal,
		changeQty,
		removeLine,
		removeLineById,
		staleLines,
		deliveryMode,
		pricing,
		itemQty
	} from '#lib/stores/cart.svelte.js';
	import { item } from '#lib/stores/catalog.svelte.js';
	import { L, kr, restaurantUrl } from '#lib/format.js';
	import { closeAll } from '#lib/layers.svelte.js';

	/** @type {{ close: () => void }} */
	let { close } = $props();

	const lines = $derived(cart());
	const stale = $derived(staleLines());
	const rest = $derived(cartRestaurant());
	const n = $derived(count());
	const pr = $derived(pricing());
	const mode = $derived(deliveryMode());

	/** @param {{ slug: string, itemId: string, opts: Record<string, string[]>, note?: string }} l */
	function lineSub(l) {
		const it = item(l.slug, l.itemId);
		/** @type {string[]} */
		const parts = [];
		(it?.options || []).forEach((g) => {
			const ch = l.opts[g.id] || [];
			g.choices.forEach((c) => {
				if (ch.includes(c.id)) parts.push(L(c.name, lang()));
			});
		});
		const o = parts.join(', ');
		return o + (l.note ? (o ? ' · ' : '') + '“' + l.note + '”' : '');
	}

	function browse() {
		close();
		goto('/#all-restaurants');
	}
</script>

<div class="d-head">
	<h2>
		{t('cart.title')}{#if n}<span class="count">{t('cart.items', { n })}</span>{/if}
	</h2>
	<button class="icon-btn sm" data-close aria-label={t('common.close')}
		><Icon name="x" size={18} /></button
	>
</div>
{#if !lines.length && !stale.length}
	<div class="d-body">
		<div class="empty">
			<span class="empty-ic"><Icon name="cart" size={28} /></span>
			<h3>{t('cart.empty')}</h3>
			<p>{t('cart.emptyText')}</p>
			<button class="btn btn-primary" onclick={browse}>{t('cart.browse')}</button>
		</div>
	</div>
{:else}
	<div class="d-body">
		{#if rest}
			<div class="card row-card">
				<span class="th"><Img src={rest.image} /></span>
				<span class="grow"
					><strong>{rest.name}</strong><small
						>{#if mode === 'delivery'}{t('rest.deliveryEta', {
								n: rest.eta + '–' + (rest.eta + 10)
							})}{:else}{t('rest.pickupEta', { n: rest.pickupEta })}{/if}</small
					></span
				>
				<a class="btn btn-secondary btn-sm" href={restaurantUrl(rest.slug)} onclick={close}
					>{t('cart.viewMenu')}</a
				>
			</div>
		{/if}
		{#each lines as l (l.key)}
			{@const it = item(l.slug, l.itemId)}
			{@const sub = lineSub(l)}
			<div class="card cart-line">
				<span class="th"><Img src={it.image} /></span>
				<div class="cl-info">
					<strong>{L(it.name, lang())}</strong>
					{#if sub}<small>{sub}</small>{/if}
					<b>{kr(lineTotal(l))}</b>
				</div>
				<div class="cl-side">
					<button
						class="icon-btn xs"
						onclick={() => removeLine(l.key)}
						aria-label={t('cart.remove')}><Icon name="trash" size={15} /></button
					>
					<Stepper
						qty={l.qty}
						decLabel={t('qty.less', { name: L(it.name, lang()) })}
						incLabel={t('qty.more', { name: L(it.name, lang()) })}
						onDec={() => changeQty(l.key, -1)}
						onInc={() => changeQty(l.key, 1)}
					/>
				</div>
			</div>
		{/each}
		{#each stale as s (s.lineId)}
			<div class="card cart-line">
				<span class="th"><Img src={null} /></span>
				<div class="cl-info"><strong>{m.cart_issue_removed()}</strong></div>
				<div class="cl-side">
					<button
						class="icon-btn xs"
						onclick={() => removeLineById(s.lineId)}
						aria-label={t('cart.remove')}><Icon name="trash" size={15} /></button
					>
				</div>
			</div>
		{/each}
		<div class="card promo-card"><PromoBox /></div>
	</div>
	<div class="d-foot">
		<Totals {pr} />
		<a class="btn btn-primary btn-lg btn-block mt-12" href="/checkout" onclick={close}
			>{t('cart.goCheckout')}</a
		>
	</div>
{/if}
