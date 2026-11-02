/* Real-mode cart with sizes: addItem sends variantId (not in optionIds), and a
   backend line's variantId maps back to the size choice. */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('#app/env', () => ({ browser: true }));
vi.mock('$app/env/public', () => ({ PUBLIC_CONVEX_URL: 'http://127.0.0.1:1', PUBLIC_MAPBOX_ACCESS_TOKEN: '' }));
vi.mock('convex/browser', () => ({ ConvexHttpClient: class {} }));
vi.mock('./address.svelte.js', () => ({ address: () => ({ id: 'a1' }) }));

import { addLine, cart, setCartCache, setCartMutations } from './cart.svelte.js';
import { setSiteData } from './catalog.svelte.js';
import { clearSession, setSession } from './session.svelte.js';

const dish = {
	id: 'm1',
	name: { en: 'Cola', sv: 'Cola' },
	price: 25,
	options: [
		{
			id: '__variant',
			variant: true,
			min: 1,
			max: 1,
			choices: [
				{ id: 'v1', name: { en: '33 cl', sv: '33 cl' }, price: 25 },
				{ id: 'v2', name: { en: '50 cl', sv: '50 cl' }, price: 32 }
			]
		},
		{ id: 'g', min: 0, max: 1, choices: [{ id: 'o1', name: { en: 'Ice', sv: 'Is' }, price: 0 }] }
	]
};

const addItem = vi.fn(async () => 'ok');
beforeEach(() => {
	addItem.mockClear();
	setSession({ id: 'u1' }, null);
	setSiteData({ restaurants: [{ slug: 'r', _restaurantId: 'rid', menu: [{ id: 'c', items: [dish] }] }] });
	setCartMutations({ addItem });
});
afterEach(() => {
	clearSession();
	setCartCache(null);
});

describe('cart with sizes', () => {
	test('addItem sends the size as variantId and only real options as optionIds', async () => {
		await addLine('r', 'm1', { __variant: ['v2'], g: ['o1'] }, 2, '');
		expect(addItem).toHaveBeenCalledWith({
			restaurantId: 'rid',
			itemId: 'm1',
			variantId: 'v2',
			optionIds: ['o1'],
			quantity: 2
		});
		// the optimistic line carries the size, so the cart shows it straight away
		expect(cart()[0].opts).toEqual({ __variant: ['v2'], g: ['o1'] });
	});

	test('two sizes of one item are two lines', async () => {
		await addLine('r', 'm1', { __variant: ['v1'] }, 1, '');
		await addLine('r', 'm1', { __variant: ['v2'] }, 1, '');
		expect(cart()).toHaveLength(2);
	});

	test('a backend line with a variantId maps back to the size choice', () => {
		setCartCache({
			restaurant: { slug: 'r' },
			lines: [{ lineId: 'l1', menuItemId: 'm1', variantId: 'v2', quantity: 1, options: [] }]
		});
		expect(cart()[0].opts).toEqual({ __variant: ['v2'] });
	});
});
