/* The new-offer popup opens 6 s after an eligible page (home, restaurant) loads,
   under the real (app) route groups: never on checkout or login. */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const h = vi.hoisted(() => ({
	path: '/',
	openModal: vi.fn(),
	toast: vi.fn()
}));
vi.mock('#app/state', () => ({
	page: {
		get url() {
			return new URL('http://localhost' + h.path);
		},
		route: { get id() { return '/(app)/(protected)/checkout'; } }
	}
}));
vi.mock('#app/navigation', () => ({ goto: vi.fn() }));
vi.mock('#lib/layers.svelte.js', () => ({ layers: [], openModal: h.openModal, toast: h.toast }));
vi.mock('#lib/stores/offers.svelte.js', () => ({
	ensureInit: vi.fn(),
	offers: () => [{ code: 'WELCOME' }],
	newOffers: () => [{ code: 'WELCOME' }],
	markAllSeen: vi.fn(),
	flashOffer: vi.fn(),
	offerKey: (o: { id?: string; code: string }) => o.id ?? o.code
}));
vi.mock('#lib/components/NewOfferModal.svelte', () => ({ default: {} }));

import OfferPopup from './OfferPopup.svelte';

beforeEach(() => {
	vi.useFakeTimers();
	h.openModal.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('OfferPopup', () => {
	test.each(['/', '/restaurants/pizza-place'])('opens 6 s after %s loads', (path) => {
		h.path = path;
		render(OfferPopup);
		vi.advanceTimersByTime(5900);
		expect(h.openModal).not.toHaveBeenCalled();
		vi.advanceTimersByTime(200);
		expect(h.openModal).toHaveBeenCalledTimes(1);
	});

	test.each(['/checkout', '/login', '/orders/abc'])('does not open on %s', (path) => {
		h.path = path;
		render(OfferPopup);
		vi.advanceTimersByTime(10000);
		expect(h.openModal).not.toHaveBeenCalled();
	});
});
