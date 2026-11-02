/*
 * Offers store in real mode: the first-visit baseline waits for the loaded list,
 * so existing offers never pop up as "new"; only offers added afterwards do.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { ensureInit, newOffers, setOffersCache } from './offers.svelte.js';
import { setSession } from './session.svelte.js';

/** @param {string} id */
const promo = (id: string) => ({
	id,
	code: id.toUpperCase(),
	kind: 'free_delivery',
	titleSv: 'Titel',
	titleEn: 'Title',
	subtitleSv: 'Text',
	subtitleEn: 'Text'
});

describe('offers first-visit baseline', () => {
	beforeEach(() => {
		window.localStorage.clear();
		setSession({ id: 'c1' }, null);
		setOffersCache([]);
	});

	test('an empty list does not set the baseline yet', () => {
		ensureInit();
		expect(window.localStorage.getItem('blinca.v1.seenOffers')).toBeNull();
		expect(newOffers()).toEqual([]);
	});

	test('offers present at the first visit are baselined as seen: no popup', () => {
		ensureInit();
		setOffersCache([promo('helg'), promo('forsta20')]);
		ensureInit();
		expect(newOffers()).toEqual([]);
	});

	test('an offer added after the baseline is new', () => {
		setOffersCache([promo('helg')]);
		ensureInit();
		setOffersCache([promo('helg'), promo('lunch10')]);
		expect(newOffers().map((o: { code: string }) => o.code)).toEqual(['LUNCH10']);
	});
});
