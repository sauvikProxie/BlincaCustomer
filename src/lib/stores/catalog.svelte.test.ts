import { beforeEach, describe, expect, test, vi } from 'vitest';

const loadRestaurantFull = vi.fn();
const loadRestaurantBySlug = vi.fn();
vi.mock('#lib/api.js', () => ({ loadRestaurantFull, loadRestaurantBySlug }));

import {
	ensureMenu,
	ensureRestaurant,
	menuFailed,
	restaurant,
	restaurantGone,
	setSiteData,
	unitPrice
} from './catalog.svelte.js';

beforeEach(() => {
	loadRestaurantFull.mockReset();
	loadRestaurantBySlug.mockReset();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	setSiteData({ restaurants: [{ slug: 'x', _lite: true, _card: { slug: 'x' }, menu: [] }] });
});

describe('ensureMenu failure', () => {
	test('a failed load is recorded instead of swallowed, and a retry clears it', async () => {
		loadRestaurantFull.mockRejectedValueOnce(new Error('network'));
		await ensureMenu('x');
		expect(menuFailed('x')).toBe(true);
		expect(restaurant('x')).toMatchObject({ _lite: true });

		loadRestaurantFull.mockResolvedValueOnce({ slug: 'x', menu: [{ id: 'c1', items: [] }] });
		await ensureMenu('x');
		expect(menuFailed('x')).toBe(false);
		expect(restaurant('x')).toMatchObject({ menu: [{ id: 'c1' }] });
	});
});

describe('restaurant missing from the (capped) list', () => {
	test('is looked up by slug once and merged into the list', async () => {
		loadRestaurantBySlug.mockResolvedValue({ slug: 'late', name: 'Late', menu: [] });
		await Promise.all([ensureRestaurant('late'), ensureRestaurant('late')]);
		expect(loadRestaurantBySlug).toHaveBeenCalledTimes(1);
		expect(restaurant('late')).toMatchObject({ name: 'Late' });
		expect(restaurantGone('late')).toBe(false);
	});

	test('only a null from getBySlug makes it "gone"; a failed lookup can be retried', async () => {
		loadRestaurantBySlug.mockRejectedValueOnce(new Error('network'));
		await ensureRestaurant('flaky');
		expect(restaurantGone('flaky')).toBe(false);
		loadRestaurantBySlug.mockResolvedValueOnce(null);
		await ensureRestaurant('flaky');
		expect(restaurantGone('flaky')).toBe(true);
		expect(restaurant('flaky')).toBeNull();
	});

	test('a restaurant already in the list is not fetched', async () => {
		await ensureRestaurant('x');
		expect(loadRestaurantBySlug).not.toHaveBeenCalled();
	});
});

describe('unitPrice with sizes', () => {
	test('the chosen size is the item price, add-ons stack on top', () => {
		setSiteData({
			restaurants: [
				{
					slug: 's',
					menu: [
						{
							id: 'c',
							items: [
								{
									id: 'i1',
									price: 25,
									from: true,
									options: [
										{
											id: '__variant',
											variant: true,
											min: 1,
											max: 1,
											choices: [
												{ id: 'v1', price: 25 },
												{ id: 'v2', price: 32 }
											]
										},
										{ id: 'g', min: 0, max: 2, choices: [{ id: 'o1', price: 5 }] }
									]
								}
							]
						}
					]
				}
			]
		});
		expect(unitPrice('s', 'i1', {})).toBe(25); // nothing chosen yet: the from price
		expect(unitPrice('s', 'i1', { __variant: ['v2'] })).toBe(32);
		expect(unitPrice('s', 'i1', { __variant: ['v2'], g: ['o1'] })).toBe(37);
	});
});
