/*
 * Conflict dialog + resolution (real-mode cart engine).
 *
 * The transplanted UI has no second seeded restaurant to exercise the
 * cross-restaurant conflict in e2e (only blinca-demo has a menu), and adding
 * seed data would change the database — out of scope. So this unit test feeds
 * the real cart engine (`stores/cart.svelte.js`) a cart from restaurant A and a
 * second restaurant B directly, and asserts:
 *   1. `addLine(B)` returns 'conflict' and sends NO addItem mutation — this is
 *      the signal `ui.js` uses to open the confirm dialog.
 *   2. `ui.js addToCart(B)` opens the ConfirmDialog (the dialog appears).
 *   3. confirming drops the other restaurant's cart and adds B in one write —
 *      `addItem(B, replaceCart: true)`, no separate `clear` call.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// ui.js pulls in the whole layer/overlay + component graph; mock everything it
// touches except the two units under test (cart engine + catalog) and the pure
// helpers (language/format), so the test stays about conflict behaviour.
vi.mock('#app/state', () => ({ page: { route: { id: '/' } } }));
const layers = vi.hoisted(() => ({
	openDrawer: vi.fn(),
	openModal: vi.fn(),
	closeAll: vi.fn(),
	toast: vi.fn(),
	toastError: vi.fn()
}));
vi.mock('#lib/layers.svelte.js', () => layers);
vi.mock('#lib/stores/user.svelte.js', () => ({ setUser: vi.fn() }));
vi.mock('#lib/stores/orders.svelte.js', () => ({ orders: () => [] }));
vi.mock('#lib/stores/favourites.svelte.js', () => ({ toggleFav: vi.fn() }));
vi.mock('#lib/components/CartDrawerContent.svelte', () => ({ default: {} }));
vi.mock('#lib/components/OffersDrawer.svelte', () => ({ default: {} }));
vi.mock('#lib/components/AddressModalContent.svelte', () => ({ default: {} }));
vi.mock('#lib/components/AddressFormContent.svelte', () => ({ default: {} }));
vi.mock('#lib/components/ItemModalContent.svelte', () => ({ default: {} }));
vi.mock('#lib/components/SearchSheet.svelte', () => ({ default: {} }));
vi.mock('#lib/components/ConfirmDialog.svelte', () => ({ default: { CONFIRM: true } }));
// The cart engine delegates promo codes to the promo engine, which reads
// $app/env/public statically (needs SvelteKit dev runtime). Conflict behaviour
// doesn't involve promos, so stub it to keep this test about the conflict.
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
	cartRestaurant,
	addLine,
	setCartCache,
	setCartMutations
} from '#lib/stores/cart.svelte.js';
import { setSession, clearSession } from '#lib/stores/session.svelte.js';
import { addToCart } from '#lib/ui.js';

const SITE = {
	vatRate: 0.12,
	offers: [],
	restaurants: [
		{
			slug: 'rest-a',
			name: 'Rest A',
			status: 'open',
			fee: 39,
			_restaurantId: 'ra',
			menu: [
				{
					id: 'c1',
					items: [{ id: 'a1', name: { en: 'A1', sv: 'A1' }, price: 100, options: [], tags: [] }]
				}
			]
		},
		{
			slug: 'rest-b',
			name: 'Rest B',
			status: 'open',
			fee: 49,
			_restaurantId: 'rb',
			menu: [
				{
					id: 'c2',
					items: [{ id: 'b1', name: { en: 'B1', sv: 'B1' }, price: 80, options: [], tags: [] }]
				}
			]
		}
	]
};

/** A live CartView holding one line from restaurant A. */
function cartAWith(lineId = 'L1') {
	return {
		restaurant: { slug: 'rest-a' },
		lines: [{ menuItemId: 'a1', quantity: 1, lineId, options: [] }]
	};
}

let addItem: ReturnType<typeof vi.fn>;
let setQuantity: ReturnType<typeof vi.fn>;
let removeItem: ReturnType<typeof vi.fn>;
let clear: ReturnType<typeof vi.fn>;

beforeEach(() => {
	setSiteData(SITE);
	setSession({ id: 'u1', email: 'user@blinca.test', name: 'U' }, null); // real mode, logged in
	addItem = vi.fn(() => Promise.resolve({ ok: true }));
	setQuantity = vi.fn(() => Promise.resolve({}));
	removeItem = vi.fn(() => Promise.resolve({}));
	clear = vi.fn(() => Promise.resolve({}));
	setCartMutations({ addItem, setQuantity, removeItem, clear });
	setCartCache(cartAWith());
	layers.openModal.mockClear();
	layers.toast.mockClear();
});

afterEach(() => {
	setCartCache(null);
	clearSession();
});

describe('cross-restaurant cart conflict', () => {
	test('cart holds restaurant A to begin with', () => {
		expect(cart()).toHaveLength(1);
		expect(cartRestaurant()?.slug).toBe('rest-a');
	});

	test('addLine for a second restaurant returns "conflict" and sends no addItem', async () => {
		const res = await addLine('rest-b', 'b1', {}, 1);
		expect(res).toBe('conflict');
		expect(addItem).not.toHaveBeenCalled();
	});

	test('addToCart opens the ConfirmDialog when a conflict is detected', async () => {
		await addToCart('rest-b', 'b1', {}, 1);
		// The dialog appears: confirm() → openModal(ConfirmDialog, props, {className:'modal-sm'}).
		expect(layers.openModal).toHaveBeenCalledTimes(1);
		const [component, props, opts] = layers.openModal.mock.calls[0];
		expect(component).toEqual({ CONFIRM: true });
		expect(opts.className).toBe('modal-sm');
		expect(typeof props.onConfirm).toBe('function');
		// Nothing added yet (the user still has to confirm).
		expect(addItem).not.toHaveBeenCalled();
	});

	test('confirming drops restaurant A and adds restaurant B in one replaceCart write', async () => {
		await addToCart('rest-b', 'b1', {}, 1);
		const props = layers.openModal.mock.calls[0][1];
		// onConfirm → addLine(B, { replaceCart: true }): the backend drops A's
		// cart in the same write, so no separate clear is sent.
		await props.onConfirm();
		expect(clear).not.toHaveBeenCalled();
		expect(addItem).toHaveBeenCalledTimes(1);
		const args = addItem.mock.calls[0][0];
		expect(args.restaurantId).toBe('rb');
		expect(args.itemId).toBe('b1');
		expect(args.quantity).toBe(1);
		expect(args.replaceCart).toBe(true);
	});
});
