// Reactive restaurant status for one restaurant. Recomputes locally with the
// shared function as the clock passes `nextChangeAt`, corrects for client clock
// skew, and schedules exactly ONE timer (not a per-second interval). SSR-safe:
// nothing runs on the server. Partner-driven changes arrive separately through
// the live Convex subscription; this only handles the time-driven transitions.
import { browser } from '$app/env';
import {
	canOrderLater,
	canOrderNow,
	isTimeDriven,
	restaurantStatusAt
} from '#lib/status/compute.js';
import type { RestaurantStatus, RestaurantStatusInput } from '#lib/types/status.js';

export type RestaurantStatusView = {
	readonly status: RestaurantStatus;
	readonly canOrderNow: boolean;
	readonly canOrderLater: boolean;
	readonly secondsUntilChange: number | null;
};

export function useRestaurantStatus(
	getInput: () => RestaurantStatusInput | null | undefined
): RestaurantStatusView {
	// offset = serverNow - clientNow, captured per payload; `now` is the corrected
	// clock, advanced only when the timer fires or we re-sync (never per second).
	let offset = $state(0);
	let now = $state(browser ? Date.now() : 0);

	const input = $derived(getInput() ?? null);

	const computed = $derived.by(
		(): { status: RestaurantStatus; nextChangeAt: number | null } | null => {
			if (!input) return null;
			// Non-time-driven states (unavailable, indefinite pause) are trusted as the
			// server sent them until the subscription pushes a change.
			if (!isTimeDriven(input.status)) {
				return { status: input.status, nextChangeAt: input.nextChangeAt };
			}
			const r = restaurantStatusAt(input.hours, input.pausedUntil ?? undefined, now);
			return { status: r.status, nextChangeAt: r.nextChangeAt };
		}
	);

	// Re-sync skew and clock whenever a fresh server payload arrives.
	$effect(() => {
		const i = getInput();
		if (!browser || !i) return;
		offset = i.serverNow - Date.now();
		now = Date.now() + offset;
	});

	// One timer to the next change; it reschedules whenever `computed` changes.
	$effect(() => {
		if (!browser) return;
		const c = computed;
		if (!c || c.nextChangeAt == null) return;
		const delay = Math.max(0, c.nextChangeAt - (Date.now() + offset));
		const id = setTimeout(() => {
			now = Date.now() + offset;
		}, delay + 50);
		return () => clearTimeout(id);
	});

	// Re-sync when the tab is shown again or the network comes back.
	$effect(() => {
		if (!browser) return;
		const resync = () => {
			now = Date.now() + offset;
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') resync();
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('online', resync);
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('online', resync);
		};
	});

	return {
		get status() {
			return computed?.status ?? ({ kind: 'unavailable' } as RestaurantStatus);
		},
		get canOrderNow() {
			return computed ? canOrderNow(computed.status) : false;
		},
		get canOrderLater() {
			return computed ? canOrderLater(computed.status) : false;
		},
		get secondsUntilChange() {
			const c = computed;
			if (!c || c.nextChangeAt == null) return null;
			return Math.max(0, Math.round((c.nextChangeAt - (Date.now() + offset)) / 1000));
		}
	};
}
