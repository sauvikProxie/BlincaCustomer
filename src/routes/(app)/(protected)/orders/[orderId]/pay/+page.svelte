<script lang="ts">
	import { browser } from '$app/env';
	import { goto } from '$app/navigation';
	import { useQuery, useAction } from 'convex-svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { ordersApi, paymentsApi } from '#lib/services/catalog.js';
	import { convexErrorCode } from '#lib/cart/convexError.js';
	import { payErrorText } from '#lib/order/payError.js';
	import { formatMoney } from '#lib/money.js';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	/**
	 * Pay page: order summary + a single "Pay {total}" action that opens Mollie's
	 * hosted checkout. The amount is never trusted from here — it is shown from
	 * the order and re-derived on the server. Once the order leaves
	 * awaiting_payment, this page hands off to the return page.
	 */
	let { data }: PageProps = $props();
	const loc = getLocale() as 'sv' | 'en';
	const sek = (c: number) => formatMoney(c ?? 0);
	const fmtTime = (ts: number) =>
		new Intl.DateTimeFormat(loc === 'sv' ? 'sv-SE' : 'en-GB', {
			timeZone: 'Europe/Stockholm',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(ts));

	const orderQuery = browser
		? useQuery(ordersApi.getMine, () => ({ orderId: data.orderId as never }))
		: null;
	const order = $derived(orderQuery?.data);
	const notFound = $derived(orderQuery?.error != null || orderQuery?.data === null);

	const startPayment = browser ? useAction(paymentsApi.start) : null;
	let starting = $state(false);
	let startError = $state<string | null>(null);

	// Order already past payment (paid elsewhere, retried, superseded): the
	// return page settles and shows the outcome.
	$effect(() => {
		if (order && order.status !== 'awaiting_payment') {
			void goto(`/orders/${data.orderId}/pay/return`);
		}
	});

	function itemName(item: { name: string; nameEn?: string }): string {
		return loc === 'en' && item.nameEn ? item.nameEn : item.name;
	}

	async function pay(): Promise<void> {
		if (!startPayment || starting) return;
		starting = true;
		startError = null;
		try {
			const result = await startPayment({ orderId: data.orderId as never, locale: loc });
			if (result?.checkoutUrl) {
				window.location.href = result.checkoutUrl;
			} else {
				startError = 'UNKNOWN';
				starting = false;
			}
		} catch (error) {
			startError = convexErrorCode(error) ?? 'UNKNOWN';
			starting = false;
		}
	}
</script>

<svelte:head><title>{m.pay_title()}</title><meta name="robots" content="noindex" /></svelte:head>

<div class="wrap narrow pad-y" data-testid="pay-page">
	{#if orderQuery?.isLoading}
		<p class="sr-only">{m.loading()}</p>
		<div class="skels" aria-hidden="true">
			<div class="skel"></div>
			<div class="skel"></div>
		</div>
	{:else if notFound || !order}
		<div class="empty">
			<span class="empty-ic"><Icon name="search" size={26} /></span>
			<h1>{m.notfound_heading()}</h1>
			<p>{m.notfound_body()}</p>
			<a class="btn btn-primary" href="/">{m.back_to_dashboard()}</a>
		</div>
	{:else}
		<p class="muted small">{m.pay_order()}</p>
		<h1 class="h1">{order.restaurant?.name ?? ''}</h1>
		<p class="muted">
			{order.fulfillment === 'delivery' ? m.pay_summary_delivery() : m.pay_summary_pickup()}
			{#if order.scheduledFor != null}
				· {m.pay_scheduled({ time: fmtTime(order.scheduledFor) })}
			{/if}
		</p>

		<div class="card pad-card mt-16">
			{#each order.items as item, i (i)}
				<div class="sum-line">
					<span><strong>{item.quantity} × {itemName(item)}</strong></span>
					<span><b>{sek(item.lineTotalCents)}</b></span>
				</div>
			{/each}
			<div class="sum-total" data-testid="pay-total">
				<span>{m.home_total()}</span><span>{sek(order.totalCents)}</span>
			</div>
			{#if startError}
				<div class="form-err" role="alert">
					<Icon name="info" size={15} />
					<span class="err-text"
						><strong>{m.pay_error_heading()}</strong><span class="err-detail"
							>{payErrorText(startError)}</span
						></span
					>
				</div>
			{/if}
			<button
				type="button"
				class="btn btn-primary btn-lg btn-block mt-12"
				data-testid="pay-button"
				disabled={starting}
				onclick={pay}
			>
				{starting ? m.pay_starting() : m.pay_cta({ total: sek(order.totalCents) })}
			</button>
			<p class="secure"><Icon name="shield" size={14} />{m.home_trust_secure()}</p>
			<p class="hint"><a class="btn-link" href="/cart">{m.co_back_to_cart()}</a></p>
		</div>
	{/if}
</div>
