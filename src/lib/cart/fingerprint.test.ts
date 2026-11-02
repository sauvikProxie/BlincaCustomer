import { describe, expect, test } from 'vitest';
import { canonicalFingerprintInput, fingerprint } from '#lib/cart/fingerprint.js';
import type { FingerprintInput } from '#lib/cart/fingerprint.js';

// The SAME vector as packages/backend/test/unit/checkout.test.ts: both
// implementations must produce this hex for this input, or fingerprints
// computed on one side will never match the other.
const VECTOR: FingerprintInput = {
	lines: [
		{
			menuItemId: 'itemB',
			variantId: 'var1',
			optionIds: ['opt2', 'opt1', 'opt1'],
			quantity: 2,
			note: 'utan lök'
		},
		{ menuItemId: 'itemA', optionIds: [], quantity: 1 }
	],
	fulfillment: 'delivery',
	address: { kind: 'id', id: 'addr1' },
	scheduledFor: 1782792000000
};

describe('fingerprint', () => {
	test('matches the shared vector', () => {
		expect(canonicalFingerprintInput(VECTOR)).toBe(
			'{"address":{"id":"addr1","kind":"id"},"fulfillment":"delivery","lines":[{"menuItemId":"itemA","note":null,"optionIds":[],"quantity":1,"variantId":null},{"menuItemId":"itemB","note":"utan lök","optionIds":["opt1","opt1","opt2"],"quantity":2,"variantId":"var1"}],"promoCode":null,"scheduledFor":1782792000000}'
		);
		expect(fingerprint(VECTOR)).toBe('de37d73d');
	});

	test('undefined and null normalize identically', () => {
		const a = fingerprint({
			lines: [{ menuItemId: 'x', optionIds: [], quantity: 1 }],
			fulfillment: 'pickup',
			address: null
		});
		const b = fingerprint({
			lines: [{ menuItemId: 'x', variantId: null, optionIds: [], quantity: 1, note: null }],
			fulfillment: 'pickup',
			address: null,
			scheduledFor: undefined,
			promoCode: undefined
		});
		expect(a).toBe(b);
	});
});
