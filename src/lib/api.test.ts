import { describe, expect, test } from 'vitest';
import { mapDish, mapHours, mapSpecialDays } from '#lib/api.js';

describe('mapHours', () => {
	test('a missing backend row is closed, never 24/7', () => {
		expect(mapHours([])).toEqual([null, null, null, null, null, null, null]);
		expect(mapHours([{ dayOfWeek: 0, openMinutes: 660, closeMinutes: 840 }])).toEqual([
			['11:00', '14:00'],
			null,
			null,
			null,
			null,
			null,
			null
		]);
		expect(mapHours(undefined)).toEqual([null, null, null, null, null, null, null]);
	});

	test('an explicit 00:00–24:00 row is the 24/7 marker', () => {
		expect(mapHours([{ dayOfWeek: 3, openMinutes: 0, closeMinutes: 1440 }])[3]).toEqual([
			'00:00',
			'00:00'
		]);
	});

	test('a close at midnight reads 00:00', () => {
		expect(mapHours([{ dayOfWeek: 0, openMinutes: 900, closeMinutes: 1440 }])[0]).toEqual([
			'15:00',
			'00:00'
		]);
	});
});

describe('mapSpecialDays', () => {
	test('keeps the date and maps ranges; no ranges means closed', () => {
		expect(
			mapSpecialDays([
				{ date: '2026-12-24', ranges: [] },
				{ date: '2026-12-25', ranges: [{ openMinutes: 720, closeMinutes: 1080 }] }
			])
		).toEqual([
			{ date: '2026-12-24', ranges: [] },
			{ date: '2026-12-25', ranges: [['12:00', '18:00']] }
		]);
	});

	test('missing special days map to none', () => {
		expect(mapSpecialDays(undefined)).toEqual([]);
	});
});

describe('mapDish sizes', () => {
	const base = { _id: 'i1', name: 'Cola', priceCents: 2500 };

	test('full menu: sizes become the Size group and the price is the cheapest ("from")', () => {
		const d = mapDish({
			...base,
			variants: [
				{ _id: 'v2', name: '50 cl', priceCents: 3200 },
				{ _id: 'v1', name: '33 cl', priceCents: 2500 }
			]
		});
		expect(d).toMatchObject({ price: 25, from: true });
		expect(d.options[0]).toMatchObject({ id: '__variant', variant: true, min: 1, max: 1 });
		expect(d.options[0].choices.map((c: { price: number }) => c.price)).toEqual([32, 25]);
	});

	test('lightweight list (home, search): hasVariants + fromPriceCents give the from price', () => {
		const d = mapDish({ ...base, priceCents: 11900, hasVariants: true, fromPriceCents: 9900 });
		expect(d).toMatchObject({ price: 99, from: true, options: [] });
	});

	test('an item without sizes keeps its price and has no "from"', () => {
		const d = mapDish({ ...base, hasVariants: false, fromPriceCents: 2500 });
		expect(d.price).toBe(25);
		expect(d.from).toBeUndefined();
	});
});
