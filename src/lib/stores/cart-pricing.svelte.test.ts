/* Real-mode pricing(): every number comes from checkout.preview (per-item VAT),
   never from a client sum or a flat 12 %. While the preview is missing or stale
   the totals read as loading. */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
	preview: {} as Record<string, unknown>,
	query: undefined as unknown
}));

vi.mock('#app/env', () => ({ browser: true }));
vi.mock('$app/env/public', () => ({ PUBLIC_CONVEX_URL: 'http://127.0.0.1:1', PUBLIC_MAPBOX_ACCESS_TOKEN: '' }));
vi.mock('convex/browser', () => ({
	ConvexHttpClient: class {
		setAuth() {}
		query = async (_fn: unknown, args: unknown) => {
			h.query = args;
			return h.preview;
		};
	}
}));
vi.mock('./catalog.svelte.js', async (orig) => ({
	...(await orig<object>()),
	item: () => ({ name: 'Dish', options: [] }),
	restaurant: (slug: string) => ({ slug, fee: 29, minOrder: 0, _restaurantId: `id-${slug}` }),
	unitPrice: () => 129
}));
vi.mock('./address.svelte.js', () => ({ address: () => ({ id: 'a1', _id: 'addr1', zip: '113 31' }) }));

import { pricing, promoContext, setCartCache, setDeliveryMode } from './cart.svelte.js';
import { clearPreview, forgetPreview, refreshPreview } from './promo.svelte.js';
import { clearSession, setAuthClient, setSession } from './session.svelte.js';

const lines = (quantity: number) => [{ lineId: 'l1', menuItemId: 'm1', quantity, options: [] }];
const cartOf = (quantity: number, slug = 'r') =>
	setCartCache({ restaurant: { slug }, lines: lines(quantity) });
const previewOf = (over: Record<string, unknown> = {}) => ({
	subtotalCents: 12900,
	deliveryFeeCents: 0,
	discountCents: 0,
	totalCents: 12900,
	vatCents: 730, // 6 % included in 129 kr, not 12 % (1382)
	minimumCents: null,
	zoneName: null,
	slots: [],
	issues: [],
	...over
});

beforeEach(() => {
	setSession({ id: 'u1' }, null);
	setAuthClient({ convex: { token: async () => ({ data: { token: 't' } }) } });
	setDeliveryMode('pickup');
	clearPreview();
	forgetPreview();
});
afterEach(() => {
	clearSession();
	setCartCache(null);
});

describe('pricing() from checkout.preview', () => {
	test('loading until the preview answers, with no client-calculated numbers', () => {
		cartOf(1);
		expect(pricing('pickup')).toMatchObject({ loading: true, sub: 0, fee: 0, total: 0, vat: 0 });
	});

	test('an empty cart is not loading', () => {
		expect(pricing('pickup')).toMatchObject({ loading: false, sub: 0, total: 0 });
	});

	test('subtotal, VAT and total are the preview values (per-item VAT)', async () => {
		cartOf(1);
		h.preview = previewOf();
		await refreshPreview(promoContext('pickup'));
		const pr = pricing('pickup');
		expect(pr.loading).toBe(false);
		expect(pr.sub).toBe(129);
		expect(pr.vat).toBe(7.3);
		expect(pr.vat).not.toBeCloseTo((129 * 0.12) / 1.12, 2);
		expect(pr.total).toBe(129);
	});

	test('a promo discount and the zone fee come from the preview', async () => {
		setDeliveryMode('delivery');
		cartOf(2);
		h.preview = previewOf({
			subtotalCents: 25800,
			deliveryFeeCents: 3900,
			discountCents: 2580,
			totalCents: 27120,
			vatCents: 1314,
			zoneName: 'Södermalm'
		});
		await refreshPreview(promoContext('delivery'));
		expect(pricing('delivery')).toMatchObject({ sub: 258, fee: 39, discount: 25.8, total: 271.2, vat: 13.14 });
		expect(h.query).toMatchObject({ fulfillment: 'delivery', addressId: 'addr1' });
	});

	test('no delivery zone: the restaurant fee is shown instead of a free delivery', async () => {
		setDeliveryMode('delivery');
		cartOf(1);
		h.preview = previewOf({ deliveryFeeCents: 0, totalCents: 12900, zoneName: null });
		await refreshPreview(promoContext('delivery'));
		expect(pricing('delivery')).toMatchObject({ fee: 29, total: 158 });
	});

	test('a cart change keeps the last totals, marked stale, until the fresh preview arrives', async () => {
		cartOf(1);
		h.preview = previewOf();
		await refreshPreview(promoContext('pickup'));
		expect(pricing('pickup')).toMatchObject({ loading: false, stale: false, total: 129 });
		cartOf(2);
		expect(pricing('pickup')).toMatchObject({ loading: false, stale: true, sub: 129, vat: 7.3, total: 129 });
		h.preview = previewOf({ subtotalCents: 25800, totalCents: 25800, vatCents: 1460 });
		await refreshPreview(promoContext('pickup'));
		expect(pricing('pickup')).toMatchObject({ loading: false, stale: false, sub: 258, vat: 14.6, total: 258 });
	});

	test('"…" (loading) only when this cart has never had a preview', async () => {
		cartOf(1);
		expect(pricing('pickup')).toMatchObject({ loading: true, stale: false });
		h.preview = previewOf();
		await refreshPreview(promoContext('pickup'));
		cartOf(1, 'other');
		// another restaurant's cart: the old totals are not this cart's
		expect(pricing('pickup')).toMatchObject({ loading: true, stale: false, total: 0 });
	});

	test('an emptied cart forgets the old totals', async () => {
		cartOf(1);
		h.preview = previewOf();
		await refreshPreview(promoContext('pickup'));
		setCartCache({ restaurant: { slug: 'r' }, lines: [] });
		expect(pricing('pickup')).toMatchObject({ loading: false, stale: false, total: 0 });
		cartOf(1);
		expect(pricing('pickup')).toMatchObject({ loading: true });
	});
});
