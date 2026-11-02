import { describe, expect, it } from 'vitest';
import { safeNext, withHash } from './safeNext.js';

describe('safeNext', () => {
	it.each([
		'//evil.com',
		'/\\evil.com',
		'https://evil.com',
		'javascript:alert(1)',
		'/\t/evil.com',
		null,
		''
	])('rejects %j', (raw) => expect(safeNext(raw)).toBe('/'));
	it('keeps a same-origin path', () => {
		expect(safeNext('/orders/1')).toBe('/orders/1');
		expect(safeNext('/orders?x=1#a')).toBe('/orders?x=1#a');
	});
});

describe('withHash', () => {
	it('puts the #fragment of the page back on the sign-in target', () => {
		expect(withHash('/orders/1', '#rate')).toBe('/orders/1#rate');
	});
	it('leaves a target that has its own fragment, and an empty hash, alone', () => {
		expect(withHash('/orders/1#x', '#rate')).toBe('/orders/1#x');
		expect(withHash('/orders/1', '')).toBe('/orders/1');
		expect(withHash('/orders/1', '#')).toBe('/orders/1');
	});
});
