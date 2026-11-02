import { describe, expect, it } from 'vitest';
import { addressLine, formatPostcode, hasValidPostcode, postcodeDigits } from './postcode.js';

describe('postcode', () => {
	it('strips spaces and requires five digits', () => {
		expect(postcodeDigits('113 31')).toBe('11331');
		expect(postcodeDigits(' 11331 ')).toBe('11331');
		expect(postcodeDigits('12 3')).toBeNull();
		expect(postcodeDigits('1133a')).toBeNull();
		expect(postcodeDigits('')).toBeNull();
		expect(postcodeDigits(undefined)).toBeNull();
	});
	it('formats as "113 31", leaves invalid input as typed', () => {
		expect(formatPostcode('11331')).toBe('113 31');
		expect(formatPostcode('113 31')).toBe('113 31');
		expect(formatPostcode('12 3')).toBe('12 3');
	});
	it('hasValidPostcode', () => {
		expect(hasValidPostcode({ zip: '113 31' })).toBe(true);
		expect(hasValidPostcode({ zip: '12 3' })).toBe(false);
		expect(hasValidPostcode(null)).toBe(false);
	});
});

describe('addressLine', () => {
	it('street, "113 31", city; missing parts are left out', () => {
		expect(addressLine('Drottninggatan 1', '11331', 'Stockholm')).toBe(
			'Drottninggatan 1, 113 31 Stockholm'
		);
		expect(addressLine('Drottninggatan 1', undefined, 'Stockholm')).toBe(
			'Drottninggatan 1, Stockholm'
		);
		expect(addressLine(undefined, undefined, undefined)).toBe('');
	});
});
