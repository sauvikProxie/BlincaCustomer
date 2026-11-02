import { describe, expect, test } from 'vitest';
import { formatAmount, formatMoney, toCents } from './money.js';
import { kr } from './format.js';

const nb = ' ';

describe('formatMoney (default)', () => {
	test('whole kronor have no decimals', () => {
		expect(formatMoney(12900)).toBe('129 kr');
		expect(formatMoney(2200)).toBe('22 kr');
		expect(formatMoney(0)).toBe('0 kr');
	});
	test('otherwise two decimals', () => {
		expect(formatMoney(6278)).toBe('62,78 kr');
		expect(formatMoney(6250)).toBe('62,50 kr');
		expect(formatMoney(5)).toBe('0,05 kr');
	});
	test('thousands use a non-breaking space', () => {
		expect(formatMoney(123400)).toBe(`1${nb}234 kr`);
		expect(formatMoney(1234550)).toBe(`12${nb}345,50 kr`);
	});
	test('negatives and bad input', () => {
		expect(formatMoney(-12900)).toBe(`−129 kr`.replace('−', '-'));
		expect(formatMoney(-6278)).toBe('-62,78 kr');
		expect(formatMoney(NaN)).toBe('0 kr');
		expect(formatMoney(undefined as never)).toBe('0 kr');
	});
	test('rounds to integer öre (no float division errors)', () => {
		expect(formatMoney(6277.6)).toBe('62,78 kr');
		expect(formatMoney(0.1 * 3 * 100)).toBe('0,30 kr');
	});
});

describe('formatMoney fixed (receipts)', () => {
	test('always two decimals', () => {
		expect(formatMoney(12900, { fixed: true })).toBe('129,00 kr');
		expect(formatMoney(0, { fixed: true })).toBe('0,00 kr');
		expect(formatMoney(100, { fixed: true })).toBe('1,00 kr');
		expect(formatMoney(6278, { fixed: true })).toBe('62,78 kr');
	});
	test('thousands and negatives', () => {
		expect(formatMoney(123456, { fixed: true })).toBe(`1${nb}234,56 kr`);
		expect(formatMoney(-123456, { fixed: true })).toBe(`-1${nb}234,56 kr`);
		expect(formatMoney(-1000, { fixed: true })).toBe('-10,00 kr');
	});
	test('a non-whole VAT amount from the preview (6 % of 129 kr, included)', () => {
		const vatCents = Math.floor((12900 * 600) / 10600); // backend lineVatCents shape
		expect(vatCents).toBe(730);
		expect(formatMoney(vatCents)).toBe('7,30 kr');
		expect(formatMoney(vatCents, { fixed: true })).toBe('7,30 kr');
		expect(formatAmount(vatCents)).toBe('7,30');
	});
});

describe('kronor adapters', () => {
	test('toCents rounds once; kr(kronor) matches formatMoney(öre)', () => {
		expect(toCents(62.78)).toBe(6278);
		expect(toCents(19.99 * 3)).toBe(5997);
		expect(kr(62.78)).toBe('62,78 kr');
		expect(kr(149)).toBe('149 kr');
		expect(kr(NaN)).toBe('0 kr');
	});
});
