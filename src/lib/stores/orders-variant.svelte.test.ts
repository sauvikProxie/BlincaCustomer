/* The size an order was placed with shows on the orders list ("Cola · 50 cl"), sv/en. */
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('#app/env', () => ({ browser: true }));
vi.mock('$app/env/public', () => ({ PUBLIC_CONVEX_URL: 'http://127.0.0.1:1', PUBLIC_MAPBOX_ACCESS_TOKEN: '' }));
vi.mock('convex/browser', () => ({ ConvexHttpClient: class {} }));

import { lineLabel, orders, setOrdersCache } from './orders.svelte.js';
import { setSiteData } from './catalog.svelte.js';
import { setSession } from './session.svelte.js';

beforeEach(() => {
	setSession({ id: 'u1' }, null);
	setSiteData({ restaurants: [{ slug: 'r', menu: [] }] });
	setOrdersCache(
		[
			{
				_id: 'o1',
				restaurantId: 'rid',
				placedAt: 1,
				totalCents: 3200,
				items: [
					{ nameSv: 'Cola', nameEn: 'Cola EN', variantName: '50 cl', variantNameEn: '50 cl EN', quantity: 1 },
					{ nameSv: 'Vatten', variantName: 'Stor', quantity: 1 },
					{ nameSv: 'Bröd', quantity: 1 }
				]
			}
		],
		() => 'r'
	);
});

describe('order line labels with a size', () => {
	test('name and size in the current language', () => {
		const [o] = orders();
		expect(lineLabel('r', o.items[0], 'sv')).toBe('Cola · 50 cl');
		expect(lineLabel('r', o.items[0], 'en')).toBe('Cola EN · 50 cl EN');
	});

	test('a size without an English name falls back to the Swedish one; no size, no suffix', () => {
		const [o] = orders();
		expect(lineLabel('r', o.items[1], 'en')).toBe('Vatten · Stor');
		expect(lineLabel('r', o.items[2], 'en')).toBe('Bröd');
	});
});
