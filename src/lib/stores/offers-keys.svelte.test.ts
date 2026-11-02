/* Seen/opened state of an offer is keyed by the banner id, so a banner without
   a public code still clears its NEW state, and renaming a code does not reset it. */
import { afterEach, describe, expect, test } from 'vitest';
import { ensureInit, isNew, markOpened, newOffers, offerKey, offers, setOffersCache } from './offers.svelte.js';

const row = (id: string, code: string | null = null) => ({
	id,
	kind: 'percent_off',
	titleSv: 'T',
	titleEn: 'T',
	subtitleSv: 'S',
	subtitleEn: 'S',
	theme: null,
	imageUrl: null,
	code,
	restaurantSlug: null,
	endsAt: null
});

afterEach(() => {
	setOffersCache([]);
	localStorage.clear();
});

describe('offer keys', () => {
	test('opening a codeless banner clears its NEW state, other banners stay new', () => {
		setOffersCache([row('b1'), row('b2')]);
		const [a, b] = offers();
		expect(isNew(a!)).toBe(true);
		markOpened(offerKey(a!));
		expect(isNew(a!)).toBe(false);
		expect(isNew(b!)).toBe(true);
	});

	test('a banner that appears after the first visit is new, existing ones are not', () => {
		setOffersCache([row('b1')]);
		ensureInit();
		expect(newOffers()).toEqual([]);
		setOffersCache([row('b1'), row('b2', 'HELG')]);
		expect(newOffers().map(offerKey)).toEqual(['b2']);
	});
});
