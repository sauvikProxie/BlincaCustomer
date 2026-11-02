<script>
	import { browser } from '#app/env';
	import { onMount } from 'svelte';
	import { goto } from '#app/navigation';
	import { useQuery, useAuth, useMutation } from 'convex-svelte';
	import { api } from '@blinca/backend/convex/_generated/api';
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import CountdownRing from '#lib/components/track/CountdownRing.svelte';
	import RefundTimeline from '#lib/components/RefundTimeline.svelte';
	import TrackSteps from '#lib/components/TrackSteps.svelte';
	import TrackMap from '#lib/components/track/TrackMap.svelte';
	import CourierCard from '#lib/components/track/CourierCard.svelte';
	import RiderCard from '#lib/components/track/RiderCard.svelte';
	import { t, lang, tOptional } from '#lib/stores/language.svelte.js';
	import { read } from '#lib/stores/core.svelte.js';
	import { orders, ordersFeed, lineLabel } from '#lib/stores/orders.svelte.js';
	import { restaurant, item } from '#lib/stores/catalog.svelte.js';
	import { address } from '#lib/stores/address.svelte.js';
	import { formatPostcode } from '#lib/postcode.js';
	import { user } from '#lib/stores/user.svelte.js';
	import { L, kr, restaurantUrl, fmtTime } from '#lib/format.js';
	import { confirm } from '#lib/ui.js';
	import { toast, toastError } from '#lib/layers.svelte.js';
	import { convexErrorCode } from '#lib/cart/convexError.js';
	import { m } from '#lib/paraglide/messages.js';
	import { track, startTracking, cancel, setTimelineCache, subscribeClock } from '#lib/stores/tracking.svelte.js';
	import { afterOrderActions } from '#lib/order/status.js';
	import { rateTarget, wantsRate } from '#lib/order/rateTarget.js';
	import { openReceipt } from '#lib/order/openReceipt.js';
	import { isDesignCheck } from '#lib/stores/session.svelte.js';
	import { ISSUE_CATEGORIES, MAX_ISSUE_MESSAGE, issueFailure, issueMessageValid } from '#lib/order/issueReport.js';

	const issueCategoryLabel = {
		missing_item: m.issue_cat_missing_item,
		late: m.issue_cat_late,
		wrong_order: m.issue_cat_wrong_order,
		quality: m.issue_cat_quality,
		other: m.issue_cat_other
	};

	/** @type {{ data: { id: string } }} */
	let { data } = $props();

	/* Same id the API returned when the order was placed (URL-decoded by the router).
	   The filtered store drops orders whose restaurant is unknown, so fall back to the
	   raw list before concluding the order is missing. */
	const order = $derived(
		orders().find((o) => o && o.id === data.id) ||
			read('orders', []).find((/** @type {any} */ o) => o && o.id === data.id) ||
			null
	);
	const tr = $derived(order ? track(order) : null);
	/* The countdown reads the shared 1s clock; keep it alive only while this
	   order still has something to wait for. */
	const live = $derived(!!tr && !tr.final);
	$effect(() => {
		if (!live) return;
		return subscribeClock();
	});

	/* Live backend timeline for this order (real mode): subscribe and push it into
	   the tracking cache, so status, ETA, step times and the cancel/reject reason
	   stay live without a reload. */
	const DESIGN = isDesignCheck();
	const auth = browser && !DESIGN ? useAuth() : null;
	const timelineQuery =
		browser && !DESIGN
			? useQuery(api.customer.orderTracking.getTimeline, () =>
					auth?.isAuthenticated && data.id ? { orderId: data.id } : 'skip'
				)
			: null;
	/* Real-mode cancel: the backend rules the window, refunds paid orders. */
	const cancelMut = browser && !DESIGN ? useMutation(api.customer.orders.cancelOrder) : null;
	/* Rating prompt: real mode only, once the order is finished (delivered or picked_up). */
	const reviewQuery =
		browser && !DESIGN
			? useQuery(api.customer.reviews.getMine, () =>
					auth?.isAuthenticated && data.id ? { orderId: data.id } : 'skip'
				)
			: null;
	const submitReview = browser && !DESIGN ? useMutation(api.customer.reviews.submit) : null;
	/* Finished orders only (delivered, or picked_up); a delivery still at picked_up
	   is allowed by the backend but is not the main call to action. */
	const after = $derived(
		afterOrderActions(timelineQuery?.data?.status, timelineQuery?.data?.fulfillment)
	);
	const canRate = $derived(!!reviewQuery && after.allowed && reviewQuery.data === null);
	const rated = $derived(reviewQuery?.data?.rating ?? 0);
	/* #rate (the "Rate your order" email link): once the order and its review state
	   have loaded, scroll to the rating card and highlight it briefly; if the order
	   cannot be rated yet, scroll to the order status instead. Runs once. */
	let rateHandled = false;
	$effect(() => {
		if (rateHandled || !browser || !wantsRate(window.location.hash)) return;
		if (!order || !tr || (!DESIGN && reviewQuery?.data === undefined)) return;
		rateHandled = true;
		const target = rateTarget(document);
		if (!target) return;
		requestAnimationFrame(() => {
			target.scrollIntoView({
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
				block: 'center'
			});
			if (target.hasAttribute('data-rate-card')) {
				target.classList.add('rate-highlight');
				setTimeout(() => target.classList.remove('rate-highlight'), 2200);
			}
		});
	});
	$effect(() => {
		if (timelineQuery) setTimelineCache(data.id, timelineQuery.data ?? null);
	});
	/* Who is bringing the order, what they are doing and where they are, from
	   the moment they accept it until it is delivered (null otherwise). Its own
	   subscription: the rider's phone reports about every 30 s. */
	const riderQuery =
		browser && !DESIGN
			? useQuery(api.customer.orderTracking.rider, () =>
					auth?.isAuthenticated && data.id && !tr?.final ? { orderId: data.id } : 'skip'
				)
			: null;
	const rider = $derived(tr && !tr.final ? (riderQuery?.data ?? null) : null);

	/* A just-placed order may take a moment to appear (cross-tab sync / live API
	   indexing). Retry for ~3 s behind a loading skeleton; only then show "not found". */
	let waited = $state(0);
	const loading = $derived(!order && (waited < 3 || ordersFeed().loading) && !ordersFeed().error);
	$effect(() => {
		if (order || waited >= 3) return;
		const timer = setTimeout(() => {
			waited += 1;
		}, 1000);
		return () => clearTimeout(timer);
	});

	const loc = $derived(lang() === 'sv' ? 'sv-SE' : 'en-GB');
	/** @param {number} ms */
	const hhmm = (ms) => fmtTime(ms, loc);

	/* Start tracking once the order is available. Runs reactively because on a fresh
	   direct load the layout seeds orders after this page has already mounted. */
	let started = false;
	$effect(() => {
		if (order && !started) {
			started = true;
			startTracking(order);
		}
	});

	/* Real orders can have no estimate yet (unpaid / awaiting accept) and a passed
	   estimate must not read as "om 0 min": show the honest state instead. */
	const headline = $derived.by(() => {
		if (!tr) return '';
		if (tr.mode === 'pickup') {
			if (tr.status === 'collected') return t('track.collectedAt', { t: hhmm(tr.etaAt) });
			if (tr.status === 'ready') return t('track.readyNow');
			if (!tr.hasEta) return t(tr.awaiting ? 'track.waitingPay' : 'track.waitingConfirm');
			if (!tr.showEta) return t('track.readySoon');
			return t('track.readyIn', { n: tr.minutesLeft });
		}
		if (tr.status === 'delivered') return t('track.deliveredAt', { t: hhmm(tr.deliveredAt ?? tr.etaAt) });
		if (!tr.hasEta) return t(tr.awaiting ? 'track.waitingPay' : 'track.waitingConfirm');
		if (!tr.showEta) return t('track.comingSoon');
		return t('track.arrivingIn', { n: tr.minutesLeft });
	});

	const note = $derived.by(() => {
		if (!tr) return '';
		if (!tr.final && tr.courier) return t('track.courierNote', { name: tr.courier.name, km: tr.distanceKm });
		return tOptional('track.toast.' + tr.status);
	});

	/* Step list for the tracker: { key, label, time } in order. Time reads as
	   "14:57" for done/current steps and "≈ 14:58" for later (estimated) ones.
	   Real mode shows a time only when there is one: a step without a timestamp
	   stays blank, and later steps fall back to the estimate only while it is
	   still ahead (past promises read "≈ <stale>" otherwise, which is a lie). */
	const trackSteps = $derived.by(() =>
		tr
			? tr.steps.map((/** @type {string} */ key, /** @type {number} */ i) => {
					const at = tr.stepTimes[i];
					const time =
						at != null
							? (i <= tr.stepIndex ? '' : '≈ ') + hhmm(at)
							: i > tr.stepIndex && tr.showEta
								? '≈ ' + hhmm(tr.etaAt)
								: '';
					return { key, label: t('track.step.' + key), time };
				})
			: []
	);
	const vehicle = $derived(/** @type {'bike' | 'car'} */ (tr?.courier?.vehicle ?? 'bike'));

	/* Design-check: placed/confirmed as in the source. Real mode: only while
	   the order is unpaid or awaiting accept — once accepted it is too late. */
	const canCancel = $derived(
		tr && (DESIGN ? tr.status === 'placed' || tr.status === 'confirmed' : tr.status === 'placed')
	);
	const a = $derived(address());
	/* Full address the tracking map geocodes: the order's own delivery address
	   when it has one, else the selected address. Display keeps its shorter
	   string. */
	const mapAddress = $derived(
		order?.address
			? [order.address.street, order.address.postalCode, order.address.city]
					.filter(Boolean)
					.join(', ')
			: a
				? [a.street, a.zip, a.city].filter(Boolean).join(', ')
				: ''
	);
	const u = $derived(user());
	/* Real orders carry their actual delivery fee; the sample orders keep the
	   source's computed difference (0 there, so no fee row). */
	const fee = $derived(
		order ? (order.fee ?? Math.max(0, (order.total || 0) - (order.amount || 0))) : 0
	);
	/** Stored order phones look like "+460701234567"; space them out for display. */
	const phoneFmt = (p) => String(p || '').replace(/^(\+46)0?/, '$1 ');
	/** @param {string} status refund status from the backend */
	const refundStatusLabel = (status) =>
		({
			requested: m.order_refund_requested(),
			processing: m.order_refund_processing(),
			succeeded: m.order_refund_succeeded(),
			failed: m.order_refund_failed()
		})[/** @type {'requested'} */ (status)] ?? status;

	let rating = $state(0);

	/** @param {number} n */
	async function rate(n) {
		if (!submitReview) {
			rating = n;
			return;
		}
		try {
			await submitReview({ orderId: data.id, rating: n });
			toast(m.order_review_thanks());
		} catch (e) {
			console.warn('[track] review failed', e);
			toastError(m.order_review_failed());
		}
	}

	/* Report a problem: real mode, finished orders (delivered or picked_up). */
	const reportIssue = browser && !DESIGN ? useMutation(api.issues.report) : null;
	const canReport = $derived(!!reportIssue && after.allowed);
	let issueCategory = $state('missing_item');
	let issueText = $state('');
	/** @type {'idle' | 'sending' | 'sent' | 'already' | 'error'} */
	let issueState = $state('idle');

	/** @param {SubmitEvent} e */
	async function sendIssue(e) {
		e.preventDefault();
		if (!reportIssue || issueState === 'sending' || !issueMessageValid(issueText)) return;
		issueState = 'sending';
		try {
			await reportIssue({ orderId: data.id, category: issueCategory, message: issueText });
			issueState = 'sent';
		} catch (err) {
			console.warn('[track] report failed', err);
			issueState = issueFailure(err);
		}
	}

	function doCancel() {
		if (!order) return;
		confirm({
			title: t('track.cancelConfirm'),
			text: '',
			ok: t('track.cancelOrder'),
			cancel: m.order_keep(),
			onOk: async () => {
				if (!cancelMut) {
					cancel(order.id);
					return;
				}
				try {
					await cancelMut({ orderId: order.id });
					toast(m.order_toast_cancelled());
				} catch (e) {
					if (convexErrorCode(e) === 'INVALID_STATE') {
						/* the kitchen accepted while the dialog was open */
						toast(t('track.cancelNoLonger'));
					} else {
						console.warn('[track] cancelOrder failed', e);
						toastError(m.order_cancel_failed());
					}
				}
			}
		});
	}

	/* phone draggable sheet */
	let sheetTop = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let startTop = 0;
	function sheetBounds() {
		const h = browser ? window.innerHeight : 800;
		return { min: 72, max: Math.max(120, h - 300) };
	}
	onMount(() => {
		const { max } = sheetBounds();
		sheetTop = max;
	});
	/** @param {PointerEvent} e */
	function dragStart(e) {
		if (tr?.cancelled) return; // no map behind it: the sheet stays open
		dragging = true;
		startY = e.clientY;
		startTop = sheetTop;
		/** @type {HTMLElement} */ (e.currentTarget).setPointerCapture?.(e.pointerId);
	}
	/** @param {PointerEvent} e */
	function dragMove(e) {
		if (!dragging) return;
		const { min, max } = sheetBounds();
		sheetTop = Math.min(max, Math.max(min, startTop + (e.clientY - startY)));
	}
	function dragEnd() {
		if (!dragging) return;
		dragging = false;
		const { min, max } = sheetBounds();
		sheetTop = sheetTop < (min + max) / 2 ? min : max;
	}
</script>

<svelte:head><title>{t('track.order', { id: tr?.orderNumber ?? data.id })} – Blinca</title></svelte:head>

{#key data.id}
{#if order && tr}
	<!-- live region for AT -->
	<div class="sr-only" aria-live="polite">{t('track.ariaStatus', { status: tr.cancelled ? t('track.cancelled') : t('track.step.' + tr.status) })}</div>

	<!-- ===================== DESKTOP / TABLET ===================== -->
	<div class="wrap track-desktop">
		<nav class="crumb" aria-label={m.breadcrumb_label()}>
			<a href="/account?tab=orders">{t('track.breadcrumb')}</a>
			<Icon name="arrow" size={14} /><span>{t('track.order', { id: tr.orderNumber })}</span>
		</nav>

		<div class="track-grid">
			<div class="track-main">
				{#if tr.cancelled}
					{@render cancelledBanner()}
				{:else}
					<section class="card status-card" data-order-status>
						<div class="sc-left">
							<span class="status-pill" data-order-status class:final={tr.final}>
								{#if !tr.final}<span class="live-dot"></span>{t('track.live')}{' · '}{/if}{t('track.step.' + tr.status)}
							</span>
							<h1 class="sc-headline">{headline}</h1>
							{@render statusSub()}
						</div>
						{#if tr.showEta || tr.final}
							<CountdownRing value={tr.minutesLeft} max={Math.max(1, Math.round((tr.etaAt - tr.stepTimes[0]) / 60000))} done={tr.final} />
						{/if}
					</section>

					<section class="card steps-card">
						<TrackSteps steps={trackSteps} current={tr.stepIndex} {vehicle} finished={tr.final} />
						{#if note}
							<p class="status-note"><span class="sn-ic"><Icon name="pin" size={17} /></span><span>{note}</span></p>
						{/if}
					</section>
				{/if}

				<!-- A cancelled or rejected order has nothing to follow on a map. -->
				{#if !tr.cancelled}
					<section class="card map-card">
						<TrackMap {tr} {rider} address={a ? `${a.street}, ${a.city}` : ''} destination={mapAddress} />
					</section>
				{/if}

				{#if tr.final && !tr.cancelled}
					{@render deliveredCard()}
				{/if}
				{#if after.primary}{@render ratingCard()}{/if}
			</div>

			<aside class="track-side">
				{#if rider}<RiderCard {rider} />{:else if tr.courier}<CourierCard courier={tr.courier} />{/if}
				{@render detailsCard()}
				{@render orderCard()}
				{#if !after.primary}{@render ratingCard()}{/if}
				{@render helpCard()}
			</aside>
		</div>
	</div>

	<!-- ===================== PHONE ===================== -->
	<div class="track-phone">
		<div class="phone-map" class:no-map={tr.cancelled}>
			{#if !tr.cancelled}
				<TrackMap {tr} {rider} address={a ? `${a.street}, ${a.city}` : ''} destination={mapAddress} />
			{/if}
			<a class="map-back" href="/account?tab=orders" aria-label={t('track.back')}><Icon name="left" size={20} /></a>
		</div>

		<section
			class="sheet"
			class:dragging
			style="top: {tr.cancelled ? sheetBounds().min : sheetTop}px"
		>
			<div
				class="sheet-handle"
				role="button"
				tabindex="0"
				aria-label={t('track.track')}
				onpointerdown={dragStart}
				onpointermove={dragMove}
				onpointerup={dragEnd}
				onpointercancel={dragEnd}
			>
				<span class="grab"></span>
			</div>
			<div class="sheet-body">
				{#if tr.cancelled}
					{@render cancelledBanner()}
				{:else}
					<span class="status-pill" data-order-status class:final={tr.final}>
						{#if !tr.final}<span class="live-dot"></span>{t('track.live')}{' · '}{/if}{t('track.step.' + tr.status)}
					</span>
					<h1 class="sc-headline">{headline}</h1>
					{@render statusSub()}
					<div class="sheet-steps">
						<TrackSteps steps={trackSteps} current={tr.stepIndex} {vehicle} finished={tr.final} />
						{#if note}
							<p class="status-note"><span class="sn-ic"><Icon name="pin" size={17} /></span><span>{note}</span></p>
						{/if}
					</div>
				{/if}
				{#if rider}<RiderCard {rider} />{:else if tr.courier}<CourierCard courier={tr.courier} />{/if}
				{#if tr.final && !tr.cancelled}{@render deliveredCard()}{/if}
				{#if after.primary}{@render ratingCard()}{/if}
				{@render detailsCard()}
				{@render orderCard()}
				{#if !after.primary}{@render ratingCard()}{/if}
				{@render helpCard()}
			</div>
		</section>
	</div>
{:else if loading}
	<!-- Order may still be arriving (just placed / cross-tab sync): skeleton meanwhile. -->
	<div class="wrap track-loading" role="status" aria-live="polite" aria-label={t('track.loading')}>
		<div class="skel skel-crumb"></div>
		<div class="skel-grid">
			<div class="skel-main">
				<div class="card skel-card">
					<div class="skel skel-pill"></div>
					<div class="skel skel-title"></div>
					<div class="skel skel-line"></div>
				</div>
				<div class="card skel-card">
					<div class="skel skel-line"></div>
					<div class="skel skel-line short"></div>
					<div class="skel skel-line"></div>
				</div>
				<div class="card skel-map"></div>
			</div>
			<aside class="skel-side">
				<div class="card skel-card">
					<div class="skel skel-line"></div>
					<div class="skel skel-line short"></div>
				</div>
				<div class="card skel-card">
					<div class="skel skel-line"></div>
					<div class="skel skel-line short"></div>
				</div>
			</aside>
		</div>
		<span class="sr-only">{t('track.loading')}</span>
	</div>
{:else}
	<div class="wrap track-missing">
		<div class="empty" role={ordersFeed().error ? 'alert' : undefined}>
			<span class="empty-ic"><Icon name="receipt" size={26} /></span>
			<h1>{ordersFeed().error ? m.error_body() : t('track.notFound')}</h1>
			{#if ordersFeed().error}
				<button type="button" class="btn btn-secondary" onclick={() => location.reload()}>{m.error_retry()}</button>
			{/if}
			<a class="btn btn-primary" href="/account?tab=orders">{t('acc.orders')}</a>
		</div>
	</div>
{/if}
{/key}

<!-- ===================== shared snippets ===================== -->
{#snippet cancelledBanner()}
	<section class="card cancel-banner">
		<span class="cb-ic"><Icon name="x" size={22} /></span>
		<div>
			<strong>{t('track.cancelled')}</strong>
			<p>{tr?.rejected ? m.order_rejected_body() : m.order_cancelled_body()}</p>
			{#if tr?.cancelReason}<p>{t('track.cancelReason', { reason: tr.cancelReason.replace(/^(Reason|Orsak):\s*/i, '') })}</p>{/if}
			{#if tr?.refund}<RefundTimeline refund={tr.refund} />{/if}
		</div>
	</section>
{/snippet}

{#snippet statusSub()}
	<p class="sc-sub">{tr.late
			? t('track.expectedLate', { id: tr.orderNumber, name: tr.restaurant?.name ?? '' })
			: tr.showEta
				? t('track.expected', { t: hhmm(tr.etaAt), id: tr.orderNumber, name: tr.restaurant?.name ?? '' })
				: t('track.orderLine', { id: tr.orderNumber, name: tr.restaurant?.name ?? '' })}</p>
{/snippet}

{#snippet detailsCard()}
	<section class="card pad-card det-card">
		<h2 class="h3">{t('track.deliveryDetails')}</h2>
		{#if tr?.mode === 'delivery' && (order?.address || a)}
			{#if order?.address}
				<p class="det-line"><Icon name="pin" size={16} /><span>{order.address.street}, {formatPostcode(order.address.postalCode)} {order.address.city}</span></p>
			{:else}
				<p class="det-line"><Icon name="pin" size={16} /><span><strong>{a.label}</strong> · {a.street}, {formatPostcode(a.zip)} {a.city}</span></p>
			{/if}
		{:else if tr?.restaurant}
			<p class="det-line"><Icon name="pin" size={16} /><span>{tr.restaurant.address || tr.restaurant.name}</span></p>
		{/if}
		{#if order?.phone || u?.phone}<p class="det-line"><Icon name="user" size={16} /><span>{phoneFmt(order?.phone || u?.phone)}</span></p>{/if}
	</section>
{/snippet}

{#snippet orderCard()}
	{#if order}
		<section class="card pad-card order-card">
			<h2 class="h3">{t('track.yourOrder')}</h2>
			<ul class="oc-items">
				{#each order.items as li, i (`${li.itemId}#${i}`)}
					{@const it = item(order.slug, li.itemId)}
					{@const nm = lineLabel(order.slug, li, lang())}
					{@const unit = li.price ?? it?.price}
					{@const lt = li.lineTotal ?? (unit != null ? unit * li.qty : null)}
					<li><span>{li.qty}× {nm}</span><span>{lt != null ? kr(lt) : ''}</span></li>
				{/each}
			</ul>
			{#if fee}<p class="oc-row"><span>{t('track.deliveryFee')}</span><span>{kr(fee)}</span></p>{/if}
			{#if order.discount}<p class="oc-row"><span>{t('promo.discount')}</span><span>−{kr(order.discount)}</span></p>{/if}
			<p class="oc-total"><span>{t('track.total')}</span><span>{kr(order.total || order.amount)}</span></p>
			{#if DESIGN || order.paid}
				<p class="oc-paid"><Icon name="check" size={15} />{DESIGN ? t('track.paidWith', { brand: 'Visa', last4: '4242' }) : m.order_update_paid()}</p>
			{:else if order.refunded}
				<p class="oc-paid">
					{m.order_refund_line({ status: refundStatusLabel('succeeded'), amount: kr(order.total || order.amount) })}
				</p>
			{/if}
			<!-- Manual refunds happen on live orders; cancelled ones show it in the banner. -->
			{#if tr?.refund && !tr.cancelled}<RefundTimeline refund={tr.refund} />{/if}
			<a
				class="btn-link sm"
				href="/account?tab=orders"
				onclick={(e) => {
					e.preventDefault();
					if (order) openReceipt(order.id);
				}}>{t('track.receipt')}</a
			>
		</section>
	{/if}
{/snippet}

{#snippet helpCard()}
	<section class="card pad-card help-card">
		<h2 class="h3">{t('track.somethingWrong')}</h2>
		<div class="help-actions">
			<a class="btn btn-secondary btn-sm" href="/info/help">{t('track.getHelp')}</a>
			{#if canCancel}
				<button class="btn btn-ghost btn-sm" onclick={doCancel}>{t('track.cancelOrder')}</button>
			{/if}
		</div>
		{#if !canCancel && !tr?.final}<p class="muted small help-note">{t('track.cancelNoLonger')}</p>{/if}
		{#if canReport}
			<form class="issue-form" data-testid="issue-form" onsubmit={sendIssue}>
				<h3 class="h3">{m.issue_title()}</h3>
				{#if issueState === 'sent' || issueState === 'already'}
					<p class="muted small" role="status" data-testid="issue-done">
						{issueState === 'sent' ? m.issue_sent() : m.issue_already()}
					</p>
				{:else}
					<select class="field" aria-label={m.issue_title()} bind:value={issueCategory} data-testid="issue-category">
						{#each ISSUE_CATEGORIES as c (c)}
							<option value={c}>{issueCategoryLabel[c]()}</option>
						{/each}
					</select>
					<label class="label mt-12" for="issue-msg">{m.issue_message_label()}</label>
					<textarea
						class="field field-area"
						id="issue-msg"
						rows="3"
						maxlength={MAX_ISSUE_MESSAGE}
						bind:value={issueText}
						data-testid="issue-message"
					></textarea>
					{#if issueState === 'error'}
						<p class="form-err" role="alert" data-testid="issue-error">{m.issue_error()}</p>
					{/if}
					<button
						class="btn btn-secondary btn-sm mt-12"
						disabled={issueState === 'sending' || !issueMessageValid(issueText)}
						data-testid="issue-send"
					>
						{issueState === 'sending' ? m.issue_sending() : m.issue_send()}
					</button>
				{/if}
			</form>
		{/if}
	</section>
{/snippet}

{#snippet stars(value, enabled)}
	<div class="dv-stars" role="group" aria-label={t('track.rate')}>
		{#each [1, 2, 3, 4, 5] as n (n)}
			<button class="dv-star" class:on={n <= value} disabled={!enabled} onclick={() => rate(n)} aria-label={String(n)}>
				<Icon name="star" size={26} />
			</button>
		{/each}
	</div>
{/snippet}

{#snippet ratingCard()}
	{#if canRate || rated}
		<section class="card deliv-card" data-rate-card>
			<strong>{t('track.rate')}</strong>
			{@render stars(rated, canRate)}
		</section>
	{/if}
{/snippet}

{#snippet deliveredCard()}
	<section class="card deliv-card">
		<span class="dv-ic"><Icon name="check" size={26} /></span>
		<strong>{t('track.deliveredEnjoy', { t: hhmm(tr?.deliveredAt ?? tr?.etaAt ?? 0) })}</strong>
		{#if DESIGN}{@render stars(rating, true)}{/if}
		<a class="btn btn-primary" href={order ? restaurantUrl(order.slug) : '/'}>{t('track.reorder')}</a>
	</section>
{/snippet}

<style>
	:global(.rate-highlight) {
		animation: rate-pulse 2.2s ease-out;
	}
	@keyframes rate-pulse {
		0%,
		60% {
			outline: 3px solid #e23744;
			outline-offset: 3px;
		}
		100% {
			outline: 3px solid transparent;
			outline-offset: 3px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.rate-highlight) {
			animation: none;
			outline: 3px solid #e23744;
			outline-offset: 3px;
		}
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.track-missing {
		padding: 60px 20px;
	}

	/* Loading skeleton (same grid as tracking; shown while retrying). */
	.track-loading {
		padding-bottom: 40px;
	}
	.skel-crumb {
		height: 16px;
		width: 220px;
		margin: 18px 0 12px;
	}
	.skel-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 400px;
		gap: 20px;
	}
	@media (max-width: 1000px) {
		.skel-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.skel-main,
	.skel-side {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}
	.skel-card {
		padding: 22px 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.skel-pill {
		height: 28px;
		width: 150px;
		border-radius: 999px;
	}
	.skel-title {
		height: 34px;
		width: 70%;
	}
	.skel-line {
		height: 14px;
	}
	.skel-line.short {
		width: 55%;
	}
	.skel-map {
		min-height: 260px;
	}

	.crumb {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: var(--muted);
		padding: 18px 0 12px;
	}
	.crumb a {
		color: var(--brand-dark);
		font-weight: 600;
	}
	.crumb :global(.ic) {
		color: var(--muted);
	}

	.track-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 400px;
		gap: 20px;
		padding-bottom: 40px;
	}
	@media (max-width: 1000px) {
		.track-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.track-main,
	.track-side {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	.status-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 28px;
	}
	.sc-left {
		min-width: 0;
		flex: 1 1 auto;
	}
	.status-pill {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: 7px;
		height: 26px;
		padding: 0 12px;
		border-radius: 999px;
		background: var(--pink);
		color: var(--brand-dark);
		font-size: 11.5px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		max-width: 100%;
	}
	.status-pill.final {
		background: var(--green-bg);
		color: var(--green);
	}
	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--brand);
		flex: none;
		animation: live 1.4s ease-in-out infinite;
	}
	.sc-headline {
		margin: 12px 0 4px;
		font-size: 34px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
		color: var(--text);
	}
	.sc-sub {
		margin: 2px 0 0;
		font-size: 14px;
		line-height: 1.55;
		color: var(--muted);
	}
	.steps-card {
		padding: 32px;
		overflow: hidden;
	}
	/* status note row, under the tracker inside the steps card */
	.status-note {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 28px 0 0;
		min-height: 58px;
		padding: 10px 16px;
		background: var(--pink);
		border: 1px solid var(--pink-border);
		border-radius: var(--r-md);
		font-size: 14px;
		font-weight: 600;
		line-height: 1.45;
		color: var(--text);
	}
	.sn-ic {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		flex: none;
		background: #fff;
		color: var(--brand);
		box-shadow: var(--shadow-sm);
	}
	.map-card {
		padding: 0;
		overflow: hidden;
	}

	.cancel-banner {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 18px 20px;
		background: var(--pink);
		border-color: var(--pink-border);
	}
	.cb-ic {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--brand);
		color: #fff;
		flex: none;
	}
	.cancel-banner strong {
		color: var(--brand-dark);
		font-size: 16px;
	}
	.cancel-banner p {
		margin: 2px 0 0;
		font-size: 13.5px;
		color: var(--text-2);
	}

	.det-line {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin: 10px 0 0;
		font-size: 14.5px;
	}
	.det-line :global(.ic) {
		color: var(--muted);
		margin-top: 2px;
		flex: none;
	}
	.oc-items {
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
	}
	.oc-items li,
	.oc-row,
	.oc-total {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 14.5px;
		padding: 5px 0;
	}
	.oc-row {
		color: var(--muted);
	}
	.oc-total {
		border-top: 1px solid var(--border);
		margin-top: 6px;
		padding-top: 10px;
		font-weight: 700;
	}
	.oc-paid {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 8px 0 0;
		font-size: 13.5px;
		color: var(--green);
	}
	.help-actions {
		display: flex;
		gap: 10px;
		margin-top: 12px;
		flex-wrap: wrap;
	}
	.issue-form {
		margin-top: 16px;
	}
	.help-note {
		margin-top: 10px;
	}

	.deliv-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 12px;
		padding: 26px 24px;
		background: var(--green-bg);
		border-color: #bfe0cb;
	}
	.dv-ic {
		width: 54px;
		height: 54px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--green);
		color: #fff;
	}
	.deliv-card strong {
		font-size: 18px;
	}
	.dv-stars {
		display: flex;
		gap: 4px;
	}
	.dv-star {
		color: #d8cfc9;
	}
	.dv-star.on {
		color: #f5a623;
	}

	/* ---------- show/hide by width ---------- */
	.track-phone {
		display: none;
	}
	@media (max-width: 760px) {
		.track-desktop {
			display: none;
		}
		.track-phone {
			display: block;
		}
	}

	/* ---------- phone ---------- */
	.phone-map {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		/* Reaches just behind the resting sheet (viewport − 300px), so no gap shows between them. */
		height: max(330px, calc(100dvh - 260px));
		z-index: 1;
	}
	.phone-map :global(.map) {
		height: 100%;
		border-radius: 0;
	}
	.phone-map.no-map {
		height: 72px;
	}
	/* the map runs behind the sheet, so the recentre button rides at the top instead of the hidden bottom edge */
	.phone-map :global(.recentre),
	.phone-map :global(.is-live .recentre) {
		top: calc(64px + env(safe-area-inset-top));
		bottom: auto;
	}
	/* keep the distance chip clear of the back button */
	.phone-map :global(.chip-tl) {
		left: 62px;
	}
	.map-back {
		position: absolute;
		top: calc(12px + env(safe-area-inset-top));
		left: 12px;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: #fff;
		color: var(--text);
		box-shadow: var(--shadow-sm);
		z-index: 2;
	}
	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		top: 0;
		z-index: 3;
		background: #fff;
		border-radius: 20px 20px 0 0;
		box-shadow: 0 -8px 30px rgba(40, 24, 24, 0.16);
		display: flex;
		flex-direction: column;
		touch-action: none;
	}
	.sheet:not(.dragging) {
		transition: top 0.25s ease;
	}
	.sheet-handle {
		display: grid;
		place-items: center;
		padding: 10px 0 6px;
		cursor: grab;
		flex: none;
	}
	.grab {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: var(--border-strong);
	}
	.sheet-body {
		flex: 1;
		overflow-y: auto;
		padding: 6px 16px calc(100px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.sheet-body .sc-headline {
		font-size: 26px;
		margin: 10px 0 2px;
	}
	.sheet-steps {
		margin-top: 6px;
	}

	@keyframes live {
		50% {
			opacity: 0.35;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.live-dot {
			animation: none;
		}
		.sheet {
			transition: none;
		}
		.skel::after {
			animation: none;
		}
	}
</style>
