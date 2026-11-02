/* Blinca – live order tracking.
   Design-check: simulated mock adapter verbatim (STEP_MS, fake couriers, geo).
   Real mode: orderTracking.getTimeline / latestStatus via root subscription
   layer, status→step mapping (MIGRATION.md). Empty when logged out. No fake
   courier (courier null, card hidden). No STEP_MS simulation. */
import { browser } from '#app/env';
import { read, write } from './core.svelte.js';
import { restaurant } from './catalog.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import {
	REAL_DELIVERY,
	REAL_PICKUP,
	realStep,
	isCancelled,
	isFinalStatus,
	isInProgress,
	isActiveStatus
} from '#lib/order/status.js';
import { isDesignCheck, isLoggedIn } from './session.svelte.js';
import { SvelteMap } from 'svelte/reactivity';

/** Timeline cache by orderId (real mode). */
const timelineCache = new SvelteMap();
/** @param {string} id @param {any} tl */
export function setTimelineCache(id, tl) {
	if (!id) return;
	if (tl) timelineCache.set(String(id), tl);
	else timelineCache.delete(String(id));
}
/** @param {Record<string, any>} map */
export function setTimelineMap(map) {
	timelineCache.clear();
	for (const k of Object.keys(map || {})) if (map[k]) timelineCache.set(String(k), map[k]);
}

/** Partner reject categories → customer-facing text ('other' has none). */
const REJECT_REASONS = {
	too_busy: () => m.order_reason_too_busy(),
	item_unavailable: () => m.order_reason_item_unavailable(),
	closing_soon: () => m.order_reason_closing_soon(),
	technical_issue: () => m.order_reason_technical_issue(),
	other: () => m.order_reason_other(),
	not_accepted_in_time: () => m.order_update_auto_rejected()
};

/** Cancel categories → customer-facing text; a customer's own cancel needs none. */
const CANCEL_REASONS = {
	restaurant: () => m.order_reason_cancelled_restaurant(),
	superseded: () => m.order_reason_superseded(),
	expired: () => m.order_reason_expired()
};

/** @param {any} tl @returns {string} customer-facing reason category for a rejected or cancelled order, '' when none */
function cancelReasonFor(tl) {
	const fn =
		/** @type {Record<string, () => string>} */ (REJECT_REASONS)[tl?.rejectReason] ??
		/** @type {Record<string, () => string>} */ (CANCEL_REASONS)[tl?.cancelCategory];
	return fn ? fn() : '';
}

/** @param {any} order @returns {any|null} timeline or null */
function timelineFor(order) {
	if (!order) return null;
	return timelineCache.get(String(order.id || order._id || order.orderId)) || null;
}

function stopTicker() {
	clearInterval(ticker);
	ticker = 0;
}

/** Mounted consumers showing a live countdown; the 1s clock runs while > 0. */
let clockSubs = 0;

/**
 * Keep the live clock ticking while the caller is mounted (call from an
 * $effect); the last unsubscribe clears the interval.
 */
export function subscribeClock() {
	if (!browser || isDesignCheck()) return () => {};
	clockSubs++;
	ensureRealTicker();
	return () => {
		if (clockSubs > 0) clockSubs--;
		if (!clockSubs) stopTicker();
	};
}

function ensureRealTicker() {
	if (!browser || ticker) return;
	ticker = window.setInterval(() => {
		clock.now = Date.now();
		// Nothing subscribed (startTracking ran on a page that navigated away):
		// stop instead of ticking forever.
		if (!clockSubs) stopTicker();
	}, 1000);
}

/** Mock cadence: one step every 20s. */
export const STEP_MS = 20000;

export const STEPS_DELIVERY = ['placed', 'confirmed', 'preparing', 'picked_up', 'on_the_way', 'delivered'];
export const STEPS_PICKUP = ['placed', 'confirmed', 'preparing', 'ready', 'collected'];
const FINAL = ['delivered', 'collected', 'cancelled'];

export const couriers = [
	{ name: 'Erik', rating: 4.9, vehicle: 'bike' },
	{ name: 'Anna', rating: 4.8, vehicle: 'bike' },
	{ name: 'Johan', rating: 5.0, vehicle: 'car' },
	{ name: 'Sara', rating: 4.7, vehicle: 'bike' }
];

/** reactive 1s clock */
export const clock = $state({ now: browser ? Date.now() : 0 });
let ticker = 0;

/** @param {string} s */
export function isFinal(s) {
	return FINAL.includes(s);
}

/** @param {string} id */
function hash(id) {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return h;
}

/** @returns {Record<string, any>} */
function records() {
	return read('tracking', {});
}

/** @param {any} rec */
function stepsFor(rec) {
	return rec.mode === 'pickup' ? STEPS_PICKUP : STEPS_DELIVERY;
}

/** @param {any} rec @param {number} now */
function statusFromRecord(rec, now) {
	if (rec.cancelledAt) return 'cancelled';
	const steps = stepsFor(rec);
	const i = Math.min(Math.floor((now - rec.startedAt) / STEP_MS), steps.length - 1);
	return steps[Math.max(0, i)];
}

function anyActive() {
	const recs = records();
	const now = Date.now();
	return Object.keys(recs).some((id) => !isFinal(statusFromRecord(recs[id], now)));
}

function ensureTicker() {
	if (!browser || ticker) return;
	ticker = window.setInterval(() => {
		clock.now = Date.now();
		if (!anyActive()) {
			clearInterval(ticker);
			ticker = 0;
		}
	}, 1000);
}

/** Begin (or resume) tracking an order. Called at checkout and on the track page. @param {any} order */
export function startTracking(order) {
	if (!order) return;
	if (!isDesignCheck()) {
		// Real mode: server drives the timeline; nothing to simulate.
		ensureRealTicker();
		return;
	}
	const recs = records();
	if (!recs[order.id]) {
		recs[order.id] = {
			startedAt: Date.now(),
			mode: order.mode === 'pickup' ? 'pickup' : 'delivery',
			courierIdx: hash(order.id) % couriers.length
		};
		write('tracking', recs);
	}
	ensureTicker();
}

/** Cancel sim – only allowed while placed/confirmed. Real mode cancels through
 *  the track page's customer.orders.cancelOrder call. @param {string} id @returns {boolean} */
export function cancel(id) {
	if (!isDesignCheck()) return false;
	const recs = records();
	const rec = recs[id];
	if (!rec) return false;
	const s = statusFromRecord(rec, Date.now());
	if (s !== 'placed' && s !== 'confirmed') return false;
	rec.cancelledAt = Date.now();
	write('tracking', recs);
	return true;
}

/** @param {{x:number,y:number}} a @param {{x:number,y:number}} b @param {number} p */
function lerp(a, b, p) {
	return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}

/** Live tracking view-model for an order (reactive: reads clock + records). @param {any} order */
export function track(order) {
	if (!isDesignCheck()) {
		const now = clock.now || Date.now();
		if (!order || !isLoggedIn()) {
			const steps = REAL_DELIVERY;
			return {
				order,
				mode: 'delivery',
				steps,
				status: 'placed',
				stepIndex: 0,
				statusHistory: [],
				stepTimes: [],
				etaAt: now,
				hasEta: false,
				showEta: false,
				late: false,
				awaiting: false,
				minutesLeft: 0,
				cancelled: false,
				cancelReason: '',
				orderNumber: order ? String(order.id).slice(-6) : null,
				final: false,
				courier: null,
				courierPos: { x: 20, y: 72 },
				points: { restaurant: { x: 20, y: 72 }, home: { x: 80, y: 26 } },
				distanceKm: 0,
				restaurant: order ? restaurant(order.slug) : null
			};
		}
		const tl = timelineFor(order);
		const backendStatus = tl?.status ?? order.status ?? 'new';
		const mode = tl?.fulfillment === 'pickup' ? 'pickup' : order.mode === 'pickup' ? 'pickup' : 'delivery';
		const steps = mode === 'pickup' ? REAL_PICKUP : REAL_DELIVERY;
		const cancelled = isCancelled(backendStatus);
		const mapped = realStep(backendStatus, mode);
		const stepIndex = mapped.index;
		const status = mapped.key;
		const final = isFinalStatus(backendStatus, mode);
		const etaAt = tl?.estimatedReadyAt ?? tl?.placedAt ?? now;
		const hasEta = tl?.estimatedReadyAt != null;
		/* Mirrors the backend's isRunningLate: an in-progress order past its promise. */
		const inProgress = isInProgress(backendStatus);
		const late = hasEta && inProgress && now > etaAt;
		/* Only a still-future estimate is worth labelling "Beräknas {t}". */
		const showEta = hasEta && !final && etaAt > now;
		const awaiting = backendStatus === 'awaiting_payment';
		const minutesLeft = !final && inProgress ? Math.max(0, Math.ceil((etaAt - now) / 60000)) : 0;
		/* Real event times only: steps without a timestamp stay null so the page
		   never presents an estimate (or placedAt) as an actual time. */
		const stepTimes = [
			tl?.placedAt ?? now,
			tl?.acceptedAt ?? null,
			tl?.readyAt ?? null,
			tl?.pickedUpAt ?? null,
			tl?.deliveredAt ?? null
		];
		const statusHistory = [];
		for (let i = 0; i <= stepIndex && i < steps.length; i++) {
			statusHistory.push({ status: steps[i], at: stepTimes[i] });
		}
		return {
			order,
			mode,
			steps,
			status,
			stepIndex,
			statusHistory,
			stepTimes,
			/* Delivered time: the real event time, else the hand-over time (never an estimate). */
			deliveredAt: tl?.deliveredAt ?? tl?.pickedUpAt ?? null,
			etaAt,
			hasEta,
			showEta,
			late,
			awaiting,
			minutesLeft,
			cancelled,
			cancelReason: cancelReasonFor(tl),
			rejected: tl?.status === 'rejected',
			refund: tl?.refund ?? null,
			orderNumber: tl?.dailyNumber ?? String(order.id).slice(-6),
			final,
			courier: null,
			courierPos: { x: 20, y: 72 },
			points: { restaurant: { x: 20, y: 72 }, home: { x: 80, y: 26 } },
			distanceKm: 0,
			restaurant: restaurant(order.slug)
		};
	}
	const now = clock.now || Date.now();
	const recs = records();
	const rec = recs[order.id] || {
		startedAt: now,
		mode: order.mode === 'pickup' ? 'pickup' : 'delivery',
		courierIdx: hash(order.id) % couriers.length
	};
	const steps = stepsFor(rec);
	const last = steps.length - 1;
	const cancelled = !!rec.cancelledAt;
	const stepIndex = cancelled ? -1 : Math.min(Math.floor((now - rec.startedAt) / STEP_MS), last);
	const status = cancelled ? 'cancelled' : steps[Math.max(0, stepIndex)];
	const final = isFinal(status);

	/** @type {{status:string, at:number}[]} */
	const statusHistory = [];
	for (let i = 0; i <= stepIndex; i++) statusHistory.push({ status: steps[i], at: rec.startedAt + i * STEP_MS });
	const stepTimes = steps.map((_, i) => rec.startedAt + i * STEP_MS);

	/* key milestone eta: delivered (delivery) / ready (pickup) */
	const etaIndex = rec.mode === 'pickup' ? STEPS_PICKUP.indexOf('ready') : last;
	const etaAt = rec.startedAt + etaIndex * STEP_MS;
	const minutesLeft = Math.max(0, Math.ceil((etaAt - now) / 60000));

	/* geo (synthetic, deterministic) */
	const points = { restaurant: { x: 20, y: 72 }, home: { x: 80, y: 26 } };
	const pickIdx = rec.mode === 'pickup' ? 99 : STEPS_DELIVERY.indexOf('picked_up');
	let p = 0;
	if (rec.mode !== 'pickup') {
		p = Math.max(0, Math.min(1, (now - rec.startedAt - pickIdx * STEP_MS) / (2 * STEP_MS)));
		if (status === 'delivered') p = 1;
	}
	const courierPos = lerp(points.restaurant, points.home, p);
	const totalKm = 3.0;
	const distanceKm = Math.max(0.1, +(totalKm * (1 - p)).toFixed(1));

	const courierOn = !cancelled && stepIndex >= pickIdx && rec.mode !== 'pickup';
	const courier = courierOn ? couriers[rec.courierIdx] : null;

	return {
		order,
		mode: rec.mode,
		steps,
		status,
		stepIndex,
		statusHistory,
		stepTimes,
		etaAt,
		hasEta: true,
		showEta: true,
		late: false,
		awaiting: false,
		minutesLeft,
		cancelled,
		cancelReason: rec.cancelReason || '',
		orderNumber: order.id,
		final,
		courier,
		courierPos,
		points,
		distanceKm,
		restaurant: restaurant(order.slug)
	};
}

/** Orders with a tracking record that are still active (non-final, or delivered <10 min ago). @param {any[]} allOrders */
export function activeTrackings(allOrders) {
	if (!isDesignCheck()) {
		if (!isLoggedIn()) return [];
		const out = [];
		for (const o of allOrders || []) {
			const tl = timelineFor(o);
			const st = tl?.status ?? o.status;
			const mode = tl?.fulfillment ?? o.mode;
			// Delivery on the way stays visible, and for 10 minutes after the
			// drop-off (as in design mode); pickup collected is final.
			// The order card carries deliveredAt too, for pages with no timeline loaded.
			const deliveredAt = tl?.deliveredAt ?? o.deliveredAt ?? null;
			const recent =
				st === 'delivered' && mode !== 'pickup' && deliveredAt != null && Date.now() - deliveredAt < 10 * 60000;
			if (isActiveStatus(st, mode) || recent) out.push(o);
		}
		return out;
	}
	const recs = records();
	const now = clock.now || Date.now();
	/** @type {any[]} */
	const out = [];
	for (const o of allOrders) {
		const rec = recs[o.id];
		if (!rec) continue;
		const s = statusFromRecord(rec, now);
		const etaIndex = rec.mode === 'pickup' ? STEPS_PICKUP.indexOf('ready') : stepsFor(rec).length - 1;
		const doneAt = rec.startedAt + (stepsFor(rec).length - 1) * STEP_MS;
		void etaIndex;
		if (!isFinal(s) || (s !== 'cancelled' && now - doneAt < 10 * 60000)) out.push(o);
	}
	return out;
}
