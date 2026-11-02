<script lang="ts">
	import { browser } from '$app/env';
	import { untrack } from 'svelte';
	import { useQuery, useAction, useAuth } from 'convex-svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { api } from '@blinca/backend/convex/_generated/api';
	import RefundTimeline from '#lib/components/RefundTimeline.svelte';
	import { paymentsApi } from '#lib/services/catalog.js';
	import { convexErrorCode } from '#lib/cart/convexError.js';
	import { payErrorText } from '#lib/order/payError.js';
	import Icon from '#lib/components/Icon.svelte';
	import { createPaySyncLoop } from '#lib/order/paySync.js';
	import type { PageProps } from './$types';

	/**
	 * Return page after Mollie. URL parameters are never trusted: on load we call
	 * payments.sync once (re-fetches from Mollie on the server), follow the live
	 * payments.getStatus, and re-sync every 5 s for up to 60 s so the page settles
	 * even when the webhook is slow. Nothing is called before the Convex session
	 * is ready; without one the page asks the customer to sign in.
	 */
	let { data }: PageProps = $props();
	const loc = getLocale() as 'sv' | 'en';
	const auth = browser ? useAuth() : null;
	const signedIn = $derived(auth?.isAuthenticated === true);
	const sessionMissing = $derived(!!auth && !auth.isLoading && !auth.isAuthenticated);

	const statusQuery = browser
		? useQuery(paymentsApi.getStatus, () =>
				signedIn ? { orderId: data.orderId as never } : 'skip'
			)
		: null;
	const syncPayment = browser ? useAction(paymentsApi.sync) : null;
	const startPayment = browser ? useAction(paymentsApi.start) : null;

	const payment = $derived(statusQuery?.data ?? null);
	// The refund timeline lives on the tracking projection, not on payment status.
	const timeline = browser
		? useQuery(api.customer.orderTracking.getTimeline, () =>
				signedIn ? { orderId: data.orderId as never } : 'skip'
			)
		: null;
	const refund = $derived(timeline?.data?.refund ?? null);

	let timedOut = $state(false);
	let retrying = $state(false);
	let retryError = $state<string | null>(null);

	// paid → success; failed/expired (canceled collapses to failed) → retry;
	// otherwise still confirming.
	const outcome = $derived.by<'paid' | 'refunded' | 'failed' | 'pending'>(() => {
		const ps = payment?.paymentStatus;
		if (ps === 'paid') return 'paid';
		if (ps === 'refunded') return 'refunded';
		if (ps === 'failed' || ps === 'expired') return 'failed';
		return 'pending';
	});

	// A cancelled or rejected order can never be paid: say so, don't offer a retry.
	const notPayable = $derived(payment?.status === 'cancelled' || payment?.status === 'rejected');

	const syncLoop = createPaySyncLoop({
		sync: async () => {
			await syncPayment?.({ orderId: data.orderId as never });
		},
		isPending: () => outcome === 'pending' && !notPayable,
		onTimeout: () => (timedOut = true)
	});

	// Armed once the session is ready; start() is a no-op while the loop runs, so
	// a re-run of this effect can never add a second sync.
	$effect(() => {
		if (!browser || !signedIn) return;
		untrack(() => syncLoop.start());
		return () => syncLoop.stop();
	});

	async function tryAgain(): Promise<void> {
		if (!startPayment || retrying) return;
		retrying = true;
		retryError = null;
		try {
			const result = await startPayment({ orderId: data.orderId as never, locale: loc });
			if (result?.checkoutUrl) {
				window.location.href = result.checkoutUrl;
			} else {
				retryError = 'UNKNOWN';
				retrying = false;
			}
		} catch (error) {
			retryError = convexErrorCode(error) ?? 'UNKNOWN';
			retrying = false;
		}
	}

	function checkAgain(): void {
		timedOut = false;
		syncLoop.stop();
		syncLoop.start();
	}
</script>

<svelte:head><title>{m.payret_title()}</title><meta name="robots" content="noindex" /></svelte:head>

<div class="wrap narrow pad-y center-card" data-testid="pay-return">
	{#if sessionMissing}
		<div class="card pad-card center" data-testid="pay-signin" role="alert">
			<span class="empty-ic"><Icon name="info" size={24} /></span>
			<h1 class="h2">{m.payret_signin_heading()}</h1>
			<p class="muted">{m.payret_signin_body()}</p>
			<div class="done-actions">
				<a
					class="btn btn-primary btn-block"
					data-testid="pay-signin-link"
					href={`/login?next=${encodeURIComponent(`/orders/${data.orderId}/pay/return`)}`}
				>
					{m.payret_signin_cta()}
				</a>
			</div>
		</div>
	{:else if outcome === 'paid'}
		<div class="card pad-card center" data-testid="pay-paid">
			<span class="done-ic"><Icon name="check" size={26} /></span>
			<h1 class="h2">{m.payret_paid_heading()}</h1>
			{#if payment?.dailyNumber != null}
				<p><strong>{m.order_number({ number: payment.dailyNumber })}</strong></p>
			{/if}
			<p class="muted">{m.payret_paid_body()}</p>
			<div class="done-actions">
				<a class="btn btn-primary btn-block" href={`/orders/${data.orderId}`}>
					{m.payret_view_order()}
				</a>
			</div>
		</div>
	{:else if outcome === 'refunded'}
		<div class="card pad-card center" data-testid="pay-refunded">
			<span class="done-ic"><Icon name="check" size={26} /></span>
			<h1 class="h2">{m.nui_pay_refunded()}</h1>
			{#if refund}<RefundTimeline {refund} />{/if}
			<div class="done-actions">
				<a class="btn btn-primary btn-block" href={`/orders/${data.orderId}`}>
					{m.payret_view_order()}
				</a>
			</div>
		</div>
	{:else if notPayable}
		<div class="card pad-card" data-testid="pay-not-payable" style="text-align:center">
			<span class="empty-ic"><Icon name="x" size={24} /></span>
			<h2 class="h2">{m.payret_failed_heading()}</h2>
			<p class="muted">{m.pay_error_order_not_payable()}</p>
			<div class="done-actions">
				<a class="btn btn-primary btn-block" href={`/orders/${data.orderId}`}>
					{m.payret_view_order()}
				</a>
				<a class="btn btn-secondary btn-block" href="/cart">{m.co_back_to_cart()}</a>
			</div>
		</div>
	{:else if outcome === 'failed'}
		<div class="card pad-card center" data-testid="pay-failed">
			<span class="empty-ic"><Icon name="x" size={24} /></span>
			<h1 class="h2">{m.payret_failed_heading()}</h1>
			<p class="muted">{m.payret_failed_body()}</p>
			{#if retryError}
				<p class="form-err" role="alert">
					<Icon name="info" size={15} />{payErrorText(retryError)}
				</p>
			{/if}
			<div class="done-actions">
				<button
					type="button"
					class="btn btn-primary btn-block"
					data-testid="pay-retry"
					disabled={retrying}
					onclick={tryAgain}
				>
					{retrying ? m.pay_starting() : m.payret_try_again()}
				</button>
				<a class="btn btn-secondary btn-block" href="/cart">{m.co_back_to_cart()}</a>
			</div>
		</div>
	{:else if timedOut}
		<div class="card pad-card center" data-testid="pay-timeout">
			<span class="empty-ic"><Icon name="clock" size={24} /></span>
			<h1 class="h2">{m.payret_timeout_heading()}</h1>
			<p class="muted">{m.payret_timeout_body()}</p>
			<div class="done-actions">
				<button
					type="button"
					class="btn btn-primary btn-block"
					data-testid="pay-check"
					onclick={checkAgain}
				>
					{m.payret_check_again()}
				</button>
			</div>
		</div>
	{:else}
		<div class="card pad-card center" data-testid="pay-confirming" role="status" aria-live="polite">
			<span class="spin" aria-hidden="true"></span>
			<h1 class="h2 mt-12">{m.payret_confirming()}</h1>
		</div>
	{/if}
</div>
