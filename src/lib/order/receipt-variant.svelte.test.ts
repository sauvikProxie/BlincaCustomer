/* The receipt (modal and PDF share this data) names the size in the current language. */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({ locale: 'sv' }));
vi.mock('#app/env', () => ({ browser: true }));
vi.mock('$app/env/public', () => ({
	PUBLIC_CONVEX_URL: 'http://127.0.0.1:1',
	PUBLIC_MAPBOX_ACCESS_TOKEN: ''
}));
vi.mock('#lib/paraglide/runtime.js', async (orig) => ({
	...(await orig<object>()),
	getLocale: () => h.locale
}));
const order = {
	_id: 'o1',
	restaurant: { slug: 'r', name: 'R' },
	items: [
		{
			name: 'Cola',
			nameEn: 'Cola EN',
			variantName: '50 cl',
			variantNameEn: '50 cl EN',
			quantity: 1,
			unitPriceCents: 3200,
			lineTotalCents: 3200,
			options: []
		}
	],
	totalCents: 3200,
	subtotalCents: 3200,
	deliveryFeeCents: 0,
	vatBreakdown: [],
	fulfillment: 'pickup',
	placedAt: 1,
	status: 'new',
	paymentStatus: 'paid'
};
vi.mock('convex/browser', () => ({
	ConvexHttpClient: class {
		setAuth() {}
		query = async () => order;
	}
}));

import { loadReceiptData } from './receipt.js';
import { setAuthClient, setSession } from '#lib/stores/session.svelte.js';

beforeEach(() => {
	setSession({ id: 'u1' }, null);
	setAuthClient({ convex: { token: async () => ({ data: { token: 't' } }) } });
});

describe('receipt size', () => {
	test.each([
		['sv', '50 cl'],
		['en', '50 cl EN']
	])('in %s', async (locale, expected) => {
		h.locale = locale;
		const data = await loadReceiptData('o1');
		expect(data?.items[0]?.variant).toBe(expected);
	});
});
