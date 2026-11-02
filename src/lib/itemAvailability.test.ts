import { describe, expect, it } from 'vitest';
import { itemUnavailable } from './itemAvailability.js';

const NOW = Date.UTC(2026, 9, 22, 10, 0);

describe('itemUnavailable', () => {
	it('is empty for available and for dishes with no availability data', () => {
		expect(itemUnavailable({ kind: 'available' }, 'sv', NOW)).toBe('');
		expect(itemUnavailable(undefined, 'sv', NOW)).toBe('');
		expect(itemUnavailable(null, 'en', NOW)).toBe('');
	});

	it('names every blocked state', () => {
		expect(itemUnavailable({ kind: 'sold_out_today' }, 'en', NOW)).not.toBe('');
		expect(itemUnavailable({ kind: 'sold_out_indefinitely' }, 'en', NOW)).not.toBe('');
		expect(itemUnavailable({ kind: 'outside_schedule' }, 'en', NOW)).not.toBe('');
		expect(itemUnavailable({ kind: 'sold_out_until', until: NOW + 3_600_000 }, 'en', NOW)).toMatch(
			/22 Oct/
		);
	});

	it('treats a lapsed timed state as available again', () => {
		expect(itemUnavailable({ kind: 'sold_out_until', until: NOW - 1 }, 'en', NOW)).toBe('');
		expect(itemUnavailable({ kind: 'outside_schedule', nextAvailableAt: NOW - 1 }, 'en', NOW)).toBe(
			''
		);
	});
});
