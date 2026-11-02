/* Real-mode status mapping in tracking.svelte.js: backend order status +
   timeline -> the customer view-model (step, cancelled, late, ETA, reasons). */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { activeTrackings, isFinal, setTimelineMap, track } from './tracking.svelte.js';
import { clearSession, setSession } from './session.svelte.js';
import { m } from '#lib/paraglide/messages.js';

const NOW = Date.now();
const order = (id = 'o1') => ({ id, slug: '', mode: 'delivery' });
const view = (tl: Record<string, unknown>, o: Record<string, unknown> = {}) => {
	const ord = { ...order(), ...o };
	setTimelineMap({ [ord.id]: { placedAt: NOW - 600_000, fulfillment: 'delivery', ...tl } });
	return track(ord);
};

beforeEach(() => setSession({ id: 'u1' }, null));
afterEach(() => {
	clearSession();
	setTimelineMap({});
});

describe('track(): status -> step', () => {
	test.each([
		['new', 'delivery', 'placed', 0],
		['awaiting_payment', 'delivery', 'placed', 0],
		['accepted', 'delivery', 'confirmed', 1],
		['ready', 'delivery', 'ready', 2],
		['picked_up', 'delivery', 'on_the_way', 3],
		['new', 'pickup', 'placed', 0],
		['accepted', 'pickup', 'confirmed', 1],
		['ready', 'pickup', 'ready', 2],
		['picked_up', 'pickup', 'collected', 3]
	])('%s (%s) -> %s at index %i', (status, fulfillment, key, index) => {
		const tr = view({ status, fulfillment });
		expect(tr.status).toBe(key);
		expect(tr.stepIndex).toBe(index);
		expect(tr.cancelled).toBe(false);
		expect(tr.mode).toBe(fulfillment);
		expect(tr.steps).toHaveLength(fulfillment === 'pickup' ? 4 : 5);
		expect(tr.steps.at(-1)).toBe(fulfillment === 'pickup' ? 'collected' : 'delivered');
	});

	test('delivered is the final green step with the real delivered time; picked_up is not final', () => {
		const tr = view({ status: 'delivered', pickedUpAt: NOW - 600_000, deliveredAt: NOW - 120_000 });
		expect(tr).toMatchObject({ status: 'delivered', stepIndex: 4, final: true, cancelled: false, deliveredAt: NOW - 120_000 });
		expect(tr.stepTimes[4]).toBe(NOW - 120_000);
		expect(tr.minutesLeft).toBe(0);
		expect(view({ status: 'picked_up', fulfillment: 'delivery' }).final).toBe(false);
	});

	test('an auto-closed delivery reads as delivered, the same as a manual one', () => {
		const tr = view({ status: 'delivered', deliveredAt: NOW });
		expect(tr).toMatchObject({ status: 'delivered', final: true });
	});

	test('a delivered pick-up order stays at collected', () => {
		expect(view({ status: 'delivered', fulfillment: 'pickup' })).toMatchObject({ status: 'collected', final: true });
	});

	test('an unknown status falls back to the first step', () => {
		expect(view({ status: 'something_new' })).toMatchObject({ status: 'placed', stepIndex: 0 });
	});

	test('the status comes from the order when there is no timeline yet', () => {
		setTimelineMap({});
		expect(track({ ...order(), status: 'ready' })).toMatchObject({ status: 'ready', stepIndex: 2 });
	});

	test('a collected pickup or a dropped-off delivery is final, an on-the-way one is not', () => {
		expect(view({ status: 'picked_up', fulfillment: 'pickup' }).final).toBe(true);
		expect(view({ status: 'picked_up', fulfillment: 'delivery' }).final).toBe(false);
		expect(view({ status: 'delivered', fulfillment: 'delivery', deliveredAt: NOW }).final).toBe(true);
		expect(view({ status: 'ready' }).final).toBe(false);
	});

	test('a delivery the rider dropped off is delivered, timed at the drop-off', () => {
		const tr = view({ status: 'delivered', pickedUpAt: NOW - 120_000, deliveredAt: NOW - 60_000 });
		expect(tr).toMatchObject({ status: 'delivered', stepIndex: 4, final: true, deliveredAt: NOW - 60_000 });
		expect(tr.stepTimes.at(-1)).toBe(NOW - 60_000);
		expect(tr.statusHistory.at(-1)).toEqual({ status: 'delivered', at: NOW - 60_000 });
	});

	test("the order card's deliveredAt counts when no timeline is loaded", () => {
		setTimelineMap({});
		expect(track({ ...order(), status: 'delivered', deliveredAt: NOW - 60_000 })).toMatchObject({
			status: 'delivered',
			final: true
		});
	});

	test('the history lists the steps reached with their real times', () => {
		const tr = view({ status: 'accepted', acceptedAt: NOW - 300_000 });
		expect(tr.statusHistory.map((h: { status: string }) => h.status)).toEqual(['placed', 'confirmed']);
		expect(tr.stepTimes).toEqual([NOW - 600_000, NOW - 300_000, null, null, null]);
	});
});

describe('track(): cancelled, rejected, refunded', () => {
	test('rejected is cancelled, flagged rejected, with the partner reason', () => {
		const tr = view({ status: 'rejected', rejectReason: 'too_busy' });
		expect(tr).toMatchObject({ cancelled: true, rejected: true, final: true, stepIndex: -1, status: 'cancelled' });
		expect(tr.cancelReason).toBe(m.order_reason_too_busy());
	});

	test.each([
		['item_unavailable', m.order_reason_item_unavailable()],
		['closing_soon', m.order_reason_closing_soon()],
		['technical_issue', m.order_reason_technical_issue()],
		['other', m.order_reason_other()],
		['not_accepted_in_time', m.order_update_auto_rejected()]
	])('reject reason %s is localized', (rejectReason, text) => {
		expect(view({ status: 'rejected', rejectReason }).cancelReason).toBe(text);
	});

	test('cancelled by the customer has no reason text', () => {
		const tr = view({ status: 'cancelled' });
		expect(tr).toMatchObject({ cancelled: true, rejected: false, final: true, cancelReason: '' });
	});

	test.each([
		['restaurant', m.order_reason_cancelled_restaurant()],
		['superseded', m.order_reason_superseded()]
	])('cancel category %s is localized', (cancelCategory, text) => {
		expect(view({ status: 'cancelled', cancelCategory }).cancelReason).toBe(text);
	});

	test('the refund travels with the view for every refund status', () => {
		for (const status of ['requested', 'processing', 'succeeded', 'failed']) {
			const refund = { status, amountCents: 5000 };
			expect(view({ status: 'cancelled', refund }).refund).toEqual(refund);
		}
		expect(view({ status: 'accepted' }).refund).toBeNull();
	});
});

describe('track(): ETA, late and awaiting payment', () => {
	test('no estimate: no ETA, nothing to count down', () => {
		expect(view({ status: 'new' })).toMatchObject({ hasEta: false, showEta: false, late: false, minutesLeft: 0 });
	});

	test('a future estimate shows the ETA and the minutes left', () => {
		const tr = view({ status: 'accepted', estimatedReadyAt: NOW + 10 * 60_000 });
		expect(tr).toMatchObject({ hasEta: true, showEta: true, late: false });
		expect(tr.minutesLeft).toBe(10);
	});

	test('a passed estimate on an in-progress order is late and shows no ETA', () => {
		const tr = view({ status: 'accepted', estimatedReadyAt: NOW - 60_000 });
		expect(tr).toMatchObject({ hasEta: true, showEta: false, late: true, minutesLeft: 0 });
	});

	test('a passed estimate is not "late" once the order left the kitchen', () => {
		expect(view({ status: 'picked_up', estimatedReadyAt: NOW - 60_000 }).late).toBe(false);
	});

	test('awaiting payment is flagged', () => {
		expect(view({ status: 'awaiting_payment' }).awaiting).toBe(true);
		expect(view({ status: 'new' }).awaiting).toBe(false);
	});

	test('the order number is the daily number, else the id suffix', () => {
		expect(view({ status: 'new', dailyNumber: 12 }).orderNumber).toBe(12);
		expect(view({ status: 'new' }, { id: 'abcdefghij' }).orderNumber).toBe('efghij');
	});
});

describe('track() when signed out', () => {
	test('returns the empty first-step view without reading the timeline', () => {
		setTimelineMap({ o1: { status: 'ready' } });
		clearSession();
		expect(track(order())).toMatchObject({ status: 'placed', stepIndex: 0, cancelled: false, final: false });
	});
});

describe('activeTrackings()', () => {
	const o = (id: string, mode = 'delivery') => ({ id, slug: '', mode });

	test('keeps orders in progress and a delivery on the way, drops finished ones', () => {
		setTimelineMap({
			a: { status: 'new', fulfillment: 'delivery' },
			b: { status: 'accepted', fulfillment: 'delivery' },
			c: { status: 'ready', fulfillment: 'pickup' },
			d: { status: 'picked_up', fulfillment: 'delivery' },
			e: { status: 'picked_up', fulfillment: 'pickup' },
			f: { status: 'rejected', fulfillment: 'delivery' },
			g: { status: 'cancelled', fulfillment: 'delivery' },
			h: { status: 'awaiting_payment', fulfillment: 'delivery' }
		});
		const ids = activeTrackings(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => o(id))).map((x: { id: string }) => x.id);
		expect(ids).toEqual(['a', 'b', 'c', 'd']);
	});

	test('a dropped-off delivery stays for 10 minutes, then leaves', () => {
		setTimelineMap({
			fresh: { status: 'delivered', fulfillment: 'delivery', deliveredAt: Date.now() - 60_000 },
			old: { status: 'delivered', fulfillment: 'delivery', deliveredAt: Date.now() - 11 * 60_000 }
		});
		const ids = activeTrackings([o('fresh'), o('old')]).map((x: { id: string }) => x.id);
		expect(ids).toEqual(['fresh']);
	});

	test('is empty when signed out', () => {
		setTimelineMap({ a: { status: 'new' } });
		clearSession();
		expect(activeTrackings([o('a')])).toEqual([]);
	});
});

test('isFinal covers delivered, collected and cancelled', () => {
	expect(['delivered', 'collected', 'cancelled'].every(isFinal)).toBe(true);
	expect(['placed', 'confirmed', 'ready', 'on_the_way'].some(isFinal)).toBe(false);
});
