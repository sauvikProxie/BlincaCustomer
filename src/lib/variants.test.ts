import { describe, expect, test } from 'vitest';
import { VARIANT_GROUP, fromPrice, splitOpts, variantGroup } from './variants.js';

const variants = [
	{ _id: 'v1', name: '33 cl', nameEn: '33 cl', priceCents: 2500 },
	{ _id: 'v2', name: 'Stor', nameEn: 'Large', priceCents: 3200 }
];

describe('variants', () => {
	test('sizes become one required single-choice group with absolute prices', () => {
		const g = variantGroup(variants)!;
		expect(g).toMatchObject({ id: VARIANT_GROUP, min: 1, max: 1, variant: true });
		expect(g.name).toEqual({ en: 'Size', sv: 'Storlek' });
		expect(g.choices).toEqual([
			{ id: 'v1', name: { en: '33 cl', sv: '33 cl' }, price: 25 },
			{ id: 'v2', name: { en: 'Large', sv: 'Stor' }, price: 32 }
		]);
	});

	test('no sizes: no group, no from price', () => {
		expect(variantGroup([])).toBeNull();
		expect(variantGroup(undefined)).toBeNull();
		expect(fromPrice([])).toBeNull();
	});

	test('from price is the cheapest size', () => {
		expect(fromPrice([...variants].reverse())).toBe(25);
	});

	test('splitOpts sends the size as variantId and keeps it out of optionIds', () => {
		expect(splitOpts({ [VARIANT_GROUP]: ['v2'], g1: ['o1', 'o2'] })).toEqual({
			variantId: 'v2',
			optionIds: ['o1', 'o2']
		});
		expect(splitOpts({ g1: ['o1'] })).toEqual({ variantId: undefined, optionIds: ['o1'] });
		expect(splitOpts(undefined)).toEqual({ variantId: undefined, optionIds: [] });
	});
});
