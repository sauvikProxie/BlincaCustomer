// Client-side recompute of the restaurant status, so the page flips open↔closed
// (and a timed pause expires) without a reload. It is built on the SAME shared
// functions the backend uses — `restaurantState` and the `stockholmTime`
// helpers, imported from @blinca/backend — so it agrees with the server.
//
// Note: the backend's richer `computeRestaurantStatus` lives in
// convex/customer/statusTypes.ts, which is not in @blinca/backend's package
// exports, so this mirrors its small union/timing mapping. compute.test.ts
// pins the two to the same instants. (A one-line package export would let us
// share the exact function instead — see the Step 2 notes.)
import { restaurantState } from '@blinca/backend/restaurantStatus';
import {
	addDays,
	crossesMidnight,
	rangesForDate,
	stockholmDate,
	stockholmWallTimeToUtc
} from '@blinca/backend/stockholmTime';
import type { HoursRange, OpeningHours } from '@blinca/backend/stockholmTime';
import type { RestaurantStatus } from '#lib/types/status.js';

/** A pause longer than this reads as "paused for a while" rather than "back soon". */
const PAUSE_SHORT_MAX_MS = 2 * 60 * 60 * 1000;
const OPEN_SEARCH_DAYS = 14;

function minuteParts(minute: number): { hour: number; minute: number } {
	return { hour: Math.floor(minute / 60), minute: minute % 60 };
}

function rangeStartTs(date: string, range: HoursRange): number {
	const [y, m, d] = date.split('-').map(Number);
	const { hour, minute } = minuteParts(range.openMinutes);
	return stockholmWallTimeToUtc(y!, m!, d!, hour, minute);
}

function rangeEndTs(date: string, range: HoursRange): number {
	const endDate = crossesMidnight(range) ? addDays(date, 1) : date;
	const [y, m, d] = endDate.split('-').map(Number);
	const { hour, minute } = minuteParts(range.closeMinutes);
	return stockholmWallTimeToUtc(y!, m!, d!, hour, minute);
}

/** The close instant of the opening range that contains `now`, or null. */
export function currentRangeCloseAt(hours: OpeningHours, now: number): number | null {
	const today = stockholmDate(now);
	for (const r of rangesForDate(hours, today)) {
		if (now >= rangeStartTs(today, r) && now < rangeEndTs(today, r)) return rangeEndTs(today, r);
	}
	const yesterday = addDays(today, -1);
	for (const r of rangesForDate(hours, yesterday)) {
		if (!crossesMidnight(r)) continue;
		if (now >= rangeStartTs(yesterday, r) && now < rangeEndTs(yesterday, r)) {
			return rangeEndTs(yesterday, r);
		}
	}
	return null;
}

/** The next instant >= `from` at which an opening range starts, or null. */
export function nextOpeningAt(hours: OpeningHours, from: number): number | null {
	const start = stockholmDate(from);
	let best: number | null = null;
	for (let i = 0; i <= OPEN_SEARCH_DAYS; i++) {
		const date = addDays(start, i);
		for (const r of rangesForDate(hours, date)) {
			const ts = rangeStartTs(date, r);
			if (ts >= from && (best === null || ts < best)) best = ts;
		}
	}
	return best;
}

export type ClientStatus = {
	status: RestaurantStatus;
	nextChangeAt: number | null;
	opensAt: number | null;
	closesAt: number | null;
};

/**
 * Recompute status from hours at `now`, assuming the restaurant is live and
 * accepting — which is always true for the states this is called on (see
 * `isTimeDriven`). Indefinite pause / unavailable are kept from the server.
 */
export function restaurantStatusAt(
	hours: OpeningHours,
	pausedUntil: number | undefined,
	now: number
): ClientStatus {
	const state = restaurantState(
		{ isActive: true, isAcceptingOrders: true, pausedUntil, hours },
		now
	);

	if (state === 'paused' && pausedUntil !== undefined && now < pausedUntil) {
		const until = pausedUntil;
		const status: RestaurantStatus =
			until - now <= PAUSE_SHORT_MAX_MS
				? { kind: 'paused_short', until }
				: { kind: 'paused_long', until };
		return { status, nextChangeAt: until, opensAt: nextOpeningAt(hours, now), closesAt: null };
	}

	if (state === 'open') {
		const closesAt = currentRangeCloseAt(hours, now);
		return { status: { kind: 'open', closesAt }, nextChangeAt: closesAt, opensAt: null, closesAt };
	}

	const opensAt = nextOpeningAt(hours, now);
	return { status: { kind: 'closed', opensAt }, nextChangeAt: opensAt, opensAt, closesAt: null };
}

/** True when the status changes purely with the clock (so the timer drives it).
 *  Indefinite pause, unavailable and permanent closure only change on a partner
 *  action, which arrives through the live Convex subscription instead. */
export function isTimeDriven(status: RestaurantStatus): boolean {
	switch (status.kind) {
		case 'open':
		case 'closed':
		case 'paused_short':
			return true;
		case 'paused_long':
			return status.until !== null;
		default:
			return false;
	}
}

export function canOrderNow(status: RestaurantStatus): boolean {
	return status.kind === 'open';
}

export function canOrderLater(status: RestaurantStatus): boolean {
	return (
		status.kind === 'open' ||
		status.kind === 'closed' ||
		status.kind === 'paused_short' ||
		status.kind === 'paused_long'
	);
}
