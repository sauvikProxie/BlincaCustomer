/* One mapping of backend order statuses for the customer app (tracking steps,
   active-order pill, account row tag). An unknown status is never "delivered":
   it reads as in progress, not final, and warns in dev. */
import { m } from '#lib/paraglide/messages.js';
import { t } from '#lib/stores/language.svelte.js';

/** Real model: a delivery ends with `delivered`; a handed-over delivery is still `on_the_way`. */
export const REAL_DELIVERY = ['placed', 'confirmed', 'ready', 'on_the_way', 'delivered'];
export const REAL_PICKUP = ['placed', 'confirmed', 'ready', 'collected'];

const KNOWN = new Set([
	'awaiting_payment',
	'new',
	'accepted',
	'ready',
	'picked_up',
	'delivered',
	'rejected',
	'cancelled'
]);

/** @type {Set<string>} */
const warned = new Set();
/** @param {unknown} status */
function warnUnknown(status) {
	if (!import.meta.env.DEV) return;
	const key = String(status);
	if (warned.has(key)) return;
	warned.add(key);
	console.warn('[order status] unknown status, shown as in progress:', status);
}

/** @param {unknown} status */
export const isCancelled = (status) => status === 'rejected' || status === 'cancelled';

/** Being worked on by the restaurant (not yet handed over). @param {unknown} status */
export const isInProgress = (status) =>
	status === 'new' || status === 'accepted' || status === 'ready';

/** Nothing more will happen: cancelled, delivered, or a collected pickup.
 *  @param {unknown} status @param {string} [fulfillment] */
export function isFinalStatus(status, fulfillment) {
	return (
		isCancelled(status) ||
		status === 'delivered' ||
		(status === 'picked_up' && fulfillment === 'pickup')
	);
}

/** Backend status → {key, index} in the real steps. Unknown reads as "placed".
 *  @param {string | undefined} status @param {string} [fulfillment] */
export function realStep(status, fulfillment) {
	const pickup = fulfillment === 'pickup';
	if (status === 'new' || status === 'awaiting_payment') return { key: 'placed', index: 0 };
	if (status === 'accepted') return { key: 'confirmed', index: 1 };
	if (status === 'ready') return { key: 'ready', index: 2 };
	if (status === 'picked_up')
		return pickup ? { key: 'collected', index: 3 } : { key: 'on_the_way', index: 3 };
	if (status === 'delivered')
		return pickup ? { key: 'collected', index: 3 } : { key: 'delivered', index: 4 };
	// (delivered is the last REAL_DELIVERY step; a pick-up never reaches it)
	if (isCancelled(status)) return { key: 'cancelled', index: -1 };
	warnUnknown(status);
	return { key: 'placed', index: 0 };
}

/** Real orders the pill/active list should show: in progress, or a delivery on the way.
 *  Unknown statuses are left out (the pill must not claim a state we cannot name).
 *  @param {string | undefined} status @param {string} [fulfillment] */
export function isActiveStatus(status, fulfillment) {
	if (isInProgress(status)) return true;
	return status === 'picked_up' && fulfillment !== 'pickup';
}

/**
 * Status tag for an order row. A missing status reads as delivered only for the
 * design-check seed rows; otherwise (and for unknown statuses) it is in progress.
 * @param {{ status?: string, mode?: string } | null | undefined} o
 * @param {boolean} designCheck
 * @returns {{ good: boolean, icon: string | null, label: string }}
 */
export function orderRowTag(o, designCheck) {
	const s = o?.status;
	if (!s) {
		if (designCheck) return { good: true, icon: 'check', label: t('acc.delivered') };
		warnUnknown(s);
		return { good: false, icon: null, label: t('acc.inProgress') };
	}
	if (s === 'picked_up') {
		// Pickup is collected here; a delivery is still on its way.
		if (o.mode === 'pickup')
			return { good: true, icon: 'check', label: m.orders_status_picked_up() };
		return { good: false, icon: null, label: m.order_step_on_the_way() };
	}
	if (s === 'delivered') {
		if (o.mode === 'pickup')
			return { good: true, icon: 'check', label: m.orders_status_picked_up() };
		return { good: true, icon: 'check', label: t('acc.delivered') };
	}
	if (s === 'rejected') return { good: false, icon: 'x', label: m.orders_status_rejected() };
	if (s === 'cancelled') return { good: false, icon: 'x', label: m.orders_status_cancelled() };
	if (s === 'awaiting_payment')
		return { good: false, icon: null, label: m.orders_status_awaiting_payment() };
	const label = /** @type {Record<string, () => string>} */ ({
		new: m.orders_status_new,
		accepted: m.orders_status_accepted,
		ready: m.orders_status_ready
	})[s];
	if (!label) {
		if (!KNOWN.has(s)) warnUnknown(s);
		return { good: false, icon: null, label: t('acc.inProgress') };
	}
	return { good: false, icon: null, label: label() };
}

/**
 * Rating and problem report are open for finished orders: delivered, or a
 * picked_up one (pick-up, or a delivery the partner has not marked delivered
 * yet; the backend allows both). `primary` is false only for that last case (and stays true when nothing is allowed, so the layout is unchanged), so the
 * page shows it after the order section instead of as the main call to action.
 * @param {string | undefined} status @param {string} [fulfillment]
 * @returns {{ allowed: boolean, primary: boolean }}
 */
export function afterOrderActions(status, fulfillment) {
	if (status === 'delivered') return { allowed: true, primary: true };
	if (status === 'picked_up') return { allowed: true, primary: fulfillment === 'pickup' };
	return { allowed: false, primary: true };
}

/**
 * Status toasts: the orders whose tracking status changed since the last call.
 * Updates `last` in place. Nothing fires on the first pass (`ready` false), for
 * an order seen for the first time, or for a cancelled order; each transition
 * fires once, because `last` already holds the new status on the next call.
 * @param {Record<string, string>} last
 * @param {{ id: string, status: string, cancelled?: boolean }[]} entries
 * @param {boolean} ready
 * @returns {{ id: string, status: string }[]}
 */
export function changedStatuses(last, entries, ready) {
	/** @type {{ id: string, status: string }[]} */
	const out = [];
	for (const e of entries) {
		const prev = last[e.id];
		if (ready && prev && prev !== e.status && !e.cancelled)
			out.push({ id: e.id, status: e.status });
		last[e.id] = e.status;
	}
	return out;
}
