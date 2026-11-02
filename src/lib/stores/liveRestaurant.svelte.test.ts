/* The restaurant page stays live: a stock change or a pause reaches the store without a reload, and
   a timer re-reads the restaurant when its next opening/closing time passes. */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';

const h = vi.hoisted(() => ({
	detail: { data: undefined } as { data: any },
	menu: { data: undefined } as { data: any },
	calls: 0,
	fetchDetail: vi.fn()
}));
vi.mock('convex-svelte', () => ({
	// useLiveRestaurant calls the detail query first, then the menu query.
	useQuery: () => (h.calls++ % 2 === 0 ? h.detail : h.menu)
}));
vi.mock('convex/browser', () => ({
	ConvexHttpClient: class {
		query = h.fetchDetail;
	}
}));
vi.mock('$app/env/public', () => ({ PUBLIC_CONVEX_URL: 'http://convex.test' }));
vi.mock('#lib/stores/session.svelte.js', () => ({ isDesignCheck: () => false }));

import { useLiveRestaurant } from './liveRestaurant.svelte.js';
import { restaurant, setSiteData } from './catalog.svelte.js';

const detail = (over: Record<string, unknown> = {}) => ({
	_id: 'r1',
	slug: 'pizza',
	name: 'Pizza',
	cuisines: [],
	status: { kind: 'open' },
	hours: { weekly: [], specialDays: [] },
	deliveryZones: [],
	...over
});
const menu = (availability: unknown) => ({
	categories: [
		{
			_id: 'c1',
			name: 'Pizzor',
			items: [{ _id: 'i1', name: 'Margherita', priceCents: 9900, availability }]
		}
	]
});
const dish = () => (restaurant('pizza') as any).menu[0].items[0];

// Reactive stand-ins for the two useQuery results.
let detailData = $state<any>(undefined);
let menuData = $state<any>(undefined);
h.detail = {
	get data() {
		return detailData;
	}
} as never;
h.menu = {
	get data() {
		return menuData;
	}
} as never;

let stop = () => {};
beforeEach(() => {
	h.calls = 0;
	detailData = detail();
	menuData = menu({ kind: 'available' });
	h.fetchDetail.mockReset();
	setSiteData({
		restaurants: [{ slug: 'pizza', name: 'Pizza', _lite: true, menu: [], status: 'open' }]
	});
});
afterEach(() => {
	stop();
	vi.useRealTimers();
});

describe('live restaurant page', () => {
	test('a dish that becomes sold out, and a changed price, show without a reload', () => {
		stop = $effect.root(() => useLiveRestaurant(() => 'pizza'));
		flushSync();
		expect(dish()).toMatchObject({ soldOut: false, price: 99 });

		menuData = menu({ kind: 'sold_out_today' });
		flushSync();
		expect(dish().soldOut).toBe(true);

		menuData = {
			categories: [
				{
					_id: 'c1',
					name: 'Pizzor',
					items: [{ _id: 'i1', name: 'Margherita', priceCents: 10900, availability: { kind: 'available' } }]
				}
			]
		};
		flushSync();
		expect(dish()).toMatchObject({ soldOut: false, price: 109 });
	});

	test('the partner pausing and resuming changes the status', () => {
		stop = $effect.root(() => useLiveRestaurant(() => 'pizza'));
		flushSync();
		expect(restaurant('pizza')?.status).toBe('open');
		detailData = detail({ status: { kind: 'paused_short' } });
		flushSync();
		expect(restaurant('pizza')?.status).toBe('paused');
		detailData = detail();
		flushSync();
		expect(restaurant('pizza')?.status).toBe('open');
	});

	test('a restaurant that is not in the home list is added from the live data', () => {
		setSiteData({ restaurants: [] });
		stop = $effect.root(() => useLiveRestaurant(() => 'pizza'));
		flushSync();
		expect(restaurant('pizza')?.name).toBe('Pizza');
	});

	test('at the next opening/closing time the restaurant is read again', async () => {
		vi.useFakeTimers();
		detailData = detail({ nextChangeAt: Date.now() + 60_000 });
		h.fetchDetail.mockResolvedValue(detail({ status: { kind: 'closed' } }));
		stop = $effect.root(() => useLiveRestaurant(() => 'pizza'));
		flushSync();
		expect(restaurant('pizza')?.status).toBe('open');
		await vi.advanceTimersByTimeAsync(61_500);
		flushSync();
		expect(h.fetchDetail).toHaveBeenCalledOnce();
		expect(restaurant('pizza')?.status).toBe('closed');
	});
});
