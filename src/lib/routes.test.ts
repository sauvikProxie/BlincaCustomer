import { describe, expect, test } from 'vitest';
import { isCheckoutPath, isHomePath, isRestaurantPath, isTrackPath } from './routes.js';

describe('route path checks', () => {
	test('home / restaurant / checkout', () => {
		expect(isHomePath('/')).toBe(true);
		expect(isHomePath('/login')).toBe(false);
		expect(isRestaurantPath('/restaurants/pizza-place')).toBe(true);
		expect(isRestaurantPath('/restaurants')).toBe(false);
		expect(isCheckoutPath('/checkout')).toBe(true);
		expect(isCheckoutPath('/checkout/x')).toBe(false);
	});
	test('track page is /orders/<id> only, not the pay pages', () => {
		expect(isTrackPath('/orders/abc')).toBe(true);
		expect(isTrackPath('/orders')).toBe(false);
		expect(isTrackPath('/orders/abc/pay')).toBe(false);
		expect(isTrackPath('/orders/abc/pay/return')).toBe(false);
	});
});
