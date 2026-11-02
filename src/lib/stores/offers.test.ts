/* Offers have one source: marketplace.listPublicOffers, mapped to the offer
   card shape. Public (no sign-in), nothing hard-coded, nothing when empty. */
import { afterEach, describe, expect, test } from 'vitest';
import {
	activeOffers,
	mapPublicOffer,
	offerKey,
	offerTheme,
	offers,
	setOffersCache
} from './offers.svelte.js';
import { clearSession } from './session.svelte.js';

const row = (over: Record<string, unknown> = {}) => ({
	id: 'b1',
	kind: 'free_delivery',
	titleSv: 'Fri leverans',
	titleEn: 'Free delivery',
	subtitleSv: 'Över 199 kr',
	subtitleEn: 'Over 199 kr',
	theme: 'brand',
	imageUrl: 'https://files.example/a.png',
	code: 'HELG',
	restaurantSlug: null,
	endsAt: null,
	...over
});

afterEach(() => {
	clearSession();
	setOffersCache([]);
});

describe('offers (real mode)', () => {
	test('are the public rows mapped to the offer shape, without signing in', () => {
		clearSession();
		setOffersCache([row(), row({ id: 'b2', kind: 'student', theme: 'pink', code: null })]);
		const list = offers();
		expect(list.map(offerKey)).toEqual(['b1', 'b2']);
		expect(list[0]).toMatchObject({
			id: 'b1',
			code: 'HELG',
			theme: 'red',
			image: 'https://files.example/a.png',
			title: { en: 'Free delivery', sv: 'Fri leverans' },
			text: { en: 'Over 199 kr', sv: 'Över 199 kr' }
		});
		expect(activeOffers()).toHaveLength(2);
	});

	test('theme maps onto the existing card themes and falls back by kind', () => {
		expect(offerTheme({ theme: 'brand' })).toBe('red');
		expect(offerTheme({ theme: 'pink' })).toBe('pink');
		expect(offerTheme({ theme: 'dark' })).toBe('dark');
		expect(offerTheme({ theme: 'neon', kind: 'free_delivery' })).toBe('red');
		expect(offerTheme({ theme: null, kind: 'student' })).toBe('pink');
		expect(offerTheme({ kind: 'percent_off' })).toBe('dark');
	});

	test('a code that is not public stays hidden (no code to copy)', () => {
		expect(mapPublicOffer(row({ code: null })).code).toBeNull();
		expect(mapPublicOffer(row({ code: '' })).code).toBeNull();
	});

	test('a missing image is null, so the card shows the plate placeholder', () => {
		expect(mapPublicOffer(row({ imageUrl: null })).image).toBeNull();
	});

	test('an end date and a restaurant slug carry over', () => {
		const o = mapPublicOffer(row({ endsAt: Date.UTC(2030, 0, 1), restaurantSlug: 'pizza' }));
		expect(o.slug).toBe('pizza');
		expect(o.endsAt).toBe('2030-01-01T00:00:00.000Z');
		setOffersCache([row({ endsAt: Date.now() - 1000 })]);
		expect(activeOffers()).toEqual([]);
	});

	test('nothing active means nothing to show: no hard-coded fallback', () => {
		setOffersCache([]);
		expect(offers()).toEqual([]);
		expect(activeOffers()).toEqual([]);
	});
});
