/*
 * ITEM_REMOVED lines (dish deleted, hidden or deactivated after it went into
 * the cart). The backend keeps the line and only says `issues: ['ITEM_REMOVED']`
 * — no name, no price — so cart() cannot map it, and before this it was
 * invisible *and* unremovable: checkout refused the order (placeOrder throws
 * ITEM_REMOVED) with no way to drop the line. Now staleLines() hands the drawer
 * and the checkout a lineId to render a remove button for.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The cart store reads $app/env through the promo engine (SvelteKit dev
// runtime); stubbing it keeps this test about the stale-line mapping.
vi.mock('#lib/stores/promo.svelte.js', () => ({
	promoCode: () => null,
	setPromo: vi.fn(),
	previewFor: () => null,
	lastPreviewFor: () => null,
	forgetPreview: vi.fn(),
	ensurePreview: vi.fn(),
	clearPreview: vi.fn(),
	refreshPreview: () => Promise.resolve(null),
	promoIssueMessage: () => ''
}));

import { setSiteData } from '#lib/stores/catalog.svelte.js';
import {
	cart,
	staleLines,
	removeLineById,
	setCartCache,
	setCartMutations
} from '#lib/stores/cart.svelte.js';
import { setSession, clearSession } from '#lib/stores/session.svelte.js';

const SITE = { vatRate: 0.12, offers: [], restaurants: [] };

let removeItem: ReturnType<typeof vi.fn>;

beforeEach(() => {
	setSiteData(SITE);
	setSession({ id: 'u1', email: 'user@blinca.test', name: 'U' }, null); // real mode, logged in
	removeItem = vi.fn(() => Promise.resolve({}));
	setCartMutations({ removeItem });
	setCartCache({
		restaurant: { slug: 'rest-a' },
		lines: [
			{ lineId: 'L9', menuItemId: 'gone', quantity: 1, options: [], issues: ['ITEM_REMOVED'] },
			{ lineId: 'L1', menuItemId: 'live', quantity: 2, options: [], issues: [] }
		]
	});
});

afterEach(() => {
	setCartCache(null);
	clearSession();
});

describe('stale ITEM_REMOVED lines', () => {
	test('staleLines() lists only the removed dish, by line id', () => {
		expect(staleLines()).toEqual([{ lineId: 'L9' }]);
	});

	test('cart() stays free of lines it cannot price or name', () => {
		// Neither item is in the site catalog here, so nothing maps — the point
		// is that staleLines() is the handle stale dishes arrive through.
		expect(cart()).toEqual([]);
		expect(staleLines()).toHaveLength(1);
	});

	test('removeLineById() drops the line optimistically and calls removeItem', () => {
		removeLineById('L9');
		expect(removeItem).toHaveBeenCalledWith({ lineId: 'L9' });
		expect(staleLines()).toEqual([]);
	});

	test('removeLineById() ignores an unknown/pending id', () => {
		removeItem.mockClear();
		removeLineById('');
		removeLineById('pending-123');
		expect(removeItem).not.toHaveBeenCalled();
	});
});
