import { describe, expect, test } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { t } from '#lib/stores/language.svelte.js';
import { fmtDate, fmtTime } from '#lib/format.js';
import { issueText, slotOptions } from './issues.js';

describe('issueText', () => {
	test('backend codes map to customer text', () => {
		expect(issueText('ADDRESS_INVALID')).toBe(m.co_address_invalid());
		expect(issueText('POSTAL_CODE_NOT_SERVED')).toBe(m.co_zone_bad());
		expect(issueText('SCHEDULED_TIME_INVALID')).toBe(m.co_slot_invalid());
		expect(issueText('RESTAURANT_CLOSED', { name: 'Pizza' })).toBe(
			t('rest.notTaking', { name: 'Pizza' })
		);
		expect(issueText('BELOW_MINIMUM_ORDER', { shortfallCents: 1250 })).toBe(
			t('rest.minLeft', { n: 13 })
		);
	});
	test('codes it does not own return null', () => {
		expect(issueText('PROMO_INVALID')).toBeNull();
		expect(issueText('SOMETHING_ELSE')).toBeNull();
	});
});

describe('slotOptions (backend instants, Stockholm time)', () => {
	// 2026-09-15 10:00 Stockholm (CEST, UTC+2; no DST change nearby)
	const now = Date.UTC(2026, 8, 15, 8, 0);
	const at = (h: number, min: number, dayOffset = 0) =>
		Date.UTC(2026, 8, 15 + dayOffset, h - 2, min);

	test('labels today, tomorrow and later days; the value is the instant in ms', () => {
		const opts = slotOptions([at(12, 15), at(9, 0, 1), at(18, 30, 3)], 'en', now, fmtDate, fmtTime);
		expect(opts.map((o) => o.v)).toEqual([
			String(at(12, 15)),
			String(at(9, 0, 1)),
			String(at(18, 30, 3))
		]);
		expect(opts[0].l).toBe(`${t('co.today')} 12:15`);
		expect(opts[1].l).toBe(`${t('co.tomorrow')} 09:00`);
		expect(opts[2].l).toMatch(/18:30$/);
		expect(opts[2].l).not.toContain(t('co.today'));
	});
	test('no instants, no options', () => {
		expect(slotOptions([], 'sv', now, fmtDate, fmtTime)).toEqual([]);
	});
});
