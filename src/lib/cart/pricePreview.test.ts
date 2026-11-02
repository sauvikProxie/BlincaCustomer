import { describe, expect, test } from 'vitest';
import { previewLineTotalCents, previewUnitPriceCents } from '#lib/cart/pricePreview.js';

// Fixed öre amounts — no clock, no backend.
describe('pricePreview', () => {
	test('base price times quantity with no extras', () => {
		expect(previewUnitPriceCents({ basePriceCents: 12900, options: [], quantity: 2 })).toBe(12900);
		expect(previewLineTotalCents({ basePriceCents: 12900, options: [], quantity: 2 })).toBe(25800);
	});

	test('a chosen variant replaces the base price', () => {
		const selection = {
			basePriceCents: 2500,
			variantPriceCents: 3200,
			options: [],
			quantity: 1
		};
		expect(previewUnitPriceCents(selection)).toBe(3200);
	});

	test('options add per unit, then the quantity multiplies', () => {
		const selection = {
			basePriceCents: 9900,
			options: [
				{ priceCents: 1500, quantity: 1 },
				{ priceCents: 0, quantity: 1 }
			],
			quantity: 3
		};
		expect(previewUnitPriceCents(selection)).toBe(11400);
		expect(previewLineTotalCents(selection)).toBe(34200);
	});

	test('a repeated option counts its quantity', () => {
		const selection = {
			basePriceCents: 9900,
			options: [{ priceCents: 1000, quantity: 2 }],
			quantity: 2
		};
		expect(previewLineTotalCents(selection)).toBe((9900 + 2000) * 2);
	});

	test('quantity below one is treated as one', () => {
		expect(previewLineTotalCents({ basePriceCents: 1000, options: [], quantity: 0 })).toBe(1000);
	});
});
