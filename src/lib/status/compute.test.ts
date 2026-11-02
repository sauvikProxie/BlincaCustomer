import { describe, expect, test } from 'vitest';
import {
	canOrderLater,
	canOrderNow,
	isTimeDriven,
	restaurantStatusAt
} from '#lib/status/compute.js';
import type { OpeningHours } from '@blinca/backend/stockholmTime';
import type { RestaurantStatus } from '#lib/types/status.js';

// Open Monday 11:00–14:00; recompute must land on the same instants the backend
// computeRestaurantStatus does (see packages/backend/test/unit/customerStatus).
const mondayLunch: OpeningHours = {
	weekly: [{ dayOfWeek: 0, openMinutes: 660, closeMinutes: 840 }],
	specialDays: []
};
const lateNight: OpeningHours = {
	weekly: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
		dayOfWeek,
		openMinutes: 1320,
		closeMinutes: 120
	})),
	specialDays: []
};

const mondayNoon = Date.parse('2026-10-05T10:00:00Z'); // 12:00 CEST

describe('restaurantStatusAt', () => {
	test('open inside hours with the right closing instant', () => {
		const r = restaurantStatusAt(mondayLunch, undefined, mondayNoon);
		expect(r.status).toEqual({ kind: 'open', closesAt: Date.parse('2026-10-05T12:00:00Z') });
		expect(r.nextChangeAt).toBe(Date.parse('2026-10-05T12:00:00Z'));
	});

	test('closed outside hours with the next opening instant', () => {
		const r = restaurantStatusAt(mondayLunch, undefined, Date.parse('2026-10-05T17:00:00Z'));
		expect(r.status).toEqual({ kind: 'closed', opensAt: Date.parse('2026-10-12T09:00:00Z') });
	});

	test('midnight-crossing hours close after midnight', () => {
		const r = restaurantStatusAt(lateNight, undefined, Date.parse('2026-10-05T21:00:00Z')); // 23:00
		expect(r.status).toEqual({ kind: 'open', closesAt: Date.parse('2026-10-06T00:00:00Z') });
	});

	test('short pause (≤2h) with an end instant', () => {
		const until = mondayNoon + 30 * 60_000;
		const r = restaurantStatusAt(mondayLunch, until, mondayNoon);
		expect(r.status).toEqual({ kind: 'paused_short', until });
		expect(r.nextChangeAt).toBe(until);
	});

	test('long pause (>2h) with an end instant', () => {
		const until = mondayNoon + 3 * 3_600_000;
		const r = restaurantStatusAt(mondayLunch, until, mondayNoon);
		expect(r.status).toEqual({ kind: 'paused_long', until });
	});

	test('DST spring-forward night stays finite and correct', () => {
		const hours: OpeningHours = {
			weekly: [{ dayOfWeek: 6, openMinutes: 60, closeMinutes: 300 }], // Sun 01:00–05:00
			specialDays: []
		};
		const r = restaurantStatusAt(hours, undefined, Date.parse('2026-03-29T02:30:00Z')); // 04:30 CEST
		expect(r.status.kind).toBe('open');
		if (r.status.kind === 'open') expect(Number.isFinite(r.status.closesAt ?? NaN)).toBe(true);
	});
});

describe('isTimeDriven / canOrder', () => {
	const cases: { status: RestaurantStatus; timeDriven: boolean; now: boolean; later: boolean }[] = [
		{ status: { kind: 'open', closesAt: 1 }, timeDriven: true, now: true, later: true },
		{ status: { kind: 'closed', opensAt: 1 }, timeDriven: true, now: false, later: true },
		{ status: { kind: 'paused_short', until: 1 }, timeDriven: true, now: false, later: true },
		{ status: { kind: 'paused_long', until: 1 }, timeDriven: true, now: false, later: true },
		{ status: { kind: 'paused_long', until: null }, timeDriven: false, now: false, later: true },
		{ status: { kind: 'unavailable' }, timeDriven: false, now: false, later: false },
		{ status: { kind: 'closed_permanently' }, timeDriven: false, now: false, later: false }
	];
	for (const c of cases) {
		test(`${c.status.kind} ${'until' in c.status ? c.status.until : ''}`.trim(), () => {
			expect(isTimeDriven(c.status)).toBe(c.timeDriven);
			expect(canOrderNow(c.status)).toBe(c.now);
			expect(canOrderLater(c.status)).toBe(c.later);
		});
	}
});
