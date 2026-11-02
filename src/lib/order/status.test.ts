import { describe, expect, test, vi } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { t } from '#lib/stores/language.svelte.js';
import {
	REAL_DELIVERY,
	REAL_PICKUP,
	afterOrderActions,
	changedStatuses,
	isActiveStatus,
	isFinalStatus,
	orderRowTag,
	realStep
} from './status.js';

describe('realStep', () => {
	test.each([
		['awaiting_payment', 'delivery', 'placed', 0],
		['new', 'delivery', 'placed', 0],
		['accepted', 'delivery', 'confirmed', 1],
		['ready', 'pickup', 'ready', 2],
		['picked_up', 'delivery', 'on_the_way', 3],
		['picked_up', 'pickup', 'collected', 3],
		['delivered', 'delivery', 'delivered', 4],
		['delivered', 'pickup', 'collected', 3],
		['rejected', 'delivery', 'cancelled', -1],
		['cancelled', 'pickup', 'cancelled', -1]
	])('%s (%s) → %s', (status, fulfillment, key, index) => {
		expect(realStep(status, fulfillment)).toEqual({ key, index });
	});

	test('an unknown status is in progress, never delivered or final', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(realStep('teleported', 'delivery')).toEqual({ key: 'placed', index: 0 });
		expect(isFinalStatus('teleported', 'delivery')).toBe(false);
		expect(isActiveStatus('teleported', 'delivery')).toBe(false);
	});
});

describe('final / active', () => {
	test('delivered, cancelled, collected pickup are final; delivery on the way is not', () => {
		expect(isFinalStatus('delivered', 'delivery')).toBe(true);
		expect(isFinalStatus('rejected')).toBe(true);
		expect(isFinalStatus('picked_up', 'pickup')).toBe(true);
		expect(isFinalStatus('picked_up', 'delivery')).toBe(false);
	});
	test('active: in progress, or a delivery on the way', () => {
		for (const s of ['new', 'accepted', 'ready']) expect(isActiveStatus(s, 'pickup')).toBe(true);
		expect(isActiveStatus('picked_up', 'delivery')).toBe(true);
		expect(isActiveStatus('picked_up', 'pickup')).toBe(false);
		for (const s of ['delivered', 'cancelled', 'rejected', 'awaiting_payment']) {
			expect(isActiveStatus(s, 'delivery')).toBe(false);
		}
	});
});

describe('orderRowTag', () => {
	const inProgress = { good: false, icon: null, label: t('acc.inProgress') };

	test('known statuses', () => {
		expect(orderRowTag({ status: 'new' }, false).label).toBe(m.orders_status_new());
		expect(orderRowTag({ status: 'picked_up', mode: 'pickup' }, false)).toMatchObject({
			good: true
		});
		expect(orderRowTag({ status: 'picked_up', mode: 'delivery' }, false).label).toBe(
			m.order_step_on_the_way()
		);
		expect(orderRowTag({ status: 'delivered', mode: 'delivery' }, false)).toEqual({
			good: true,
			icon: 'check',
			label: t('acc.delivered')
		});
		expect(orderRowTag({ status: 'cancelled' }, false)).toMatchObject({ good: false, icon: 'x' });
	});

	test('unknown status: neutral "In progress", never the raw string or delivered', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (const dc of [true, false])
			expect(orderRowTag({ status: 'out_for_unicorn' }, dc)).toEqual(inProgress);
		expect(warn).toHaveBeenCalled();
	});

	test('missing status: delivered only in design-check', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(orderRowTag({}, true)).toEqual({ good: true, icon: 'check', label: t('acc.delivered') });
		expect(orderRowTag({}, false)).toEqual(inProgress);
		expect(orderRowTag(undefined, false)).toEqual(inProgress);
	});
});

describe('delivered flow', () => {
	test('a delivery ends with the delivered step; a pick-up is unchanged', () => {
		expect(REAL_DELIVERY.at(-1)).toBe('delivered');
		expect(REAL_PICKUP.at(-1)).toBe('collected');
		expect(REAL_DELIVERY[realStep('picked_up', 'delivery').index]).toBe('on_the_way');
		expect(REAL_DELIVERY[realStep('delivered', 'delivery').index]).toBe('delivered');
	});

	test('the pill closes on delivered, stays for a delivery on the way', () => {
		expect(isActiveStatus('picked_up', 'delivery')).toBe(true);
		expect(isActiveStatus('delivered', 'delivery')).toBe(false);
	});

	test('delivered row tag is final for a delivery', () => {
		expect(orderRowTag({ status: 'delivered', mode: 'delivery' }, false)).toMatchObject({
			good: true,
			icon: 'check'
		});
	});

	test('review/issue: delivered and picked_up allowed; a delivery at picked_up is secondary', () => {
		expect(afterOrderActions('delivered', 'delivery')).toEqual({ allowed: true, primary: true });
		expect(afterOrderActions('picked_up', 'pickup')).toEqual({ allowed: true, primary: true });
		expect(afterOrderActions('picked_up', 'delivery')).toEqual({ allowed: true, primary: false });
		for (const s of ['new', 'accepted', 'ready', 'cancelled', 'rejected', undefined])
			expect(afterOrderActions(s, 'delivery').allowed).toBe(false);
	});
});

describe('changedStatuses (toasts)', () => {
	test('fires once when an order becomes delivered, not on first sight or after', () => {
		const last: Record<string, string> = {};
		expect(changedStatuses(last, [{ id: 'a', status: 'delivered' }], false)).toEqual([]);
		const last2: Record<string, string> = {};
		changedStatuses(last2, [{ id: 'a', status: 'picked_up' }], false);
		expect(changedStatuses(last2, [{ id: 'a', status: 'picked_up' }], true)).toEqual([]);
		expect(changedStatuses(last2, [{ id: 'a', status: 'delivered' }], true)).toEqual([
			{ id: 'a', status: 'delivered' }
		]);
		expect(changedStatuses(last2, [{ id: 'a', status: 'delivered' }], true)).toEqual([]);
	});

	test('a new order, or a cancelled one, never toasts', () => {
		const last: Record<string, string> = { a: 'new' };
		expect(
			changedStatuses(
				last,
				[
					{ id: 'b', status: 'new' },
					{ id: 'a', status: 'cancelled', cancelled: true }
				],
				true
			)
		).toEqual([]);
	});
});
