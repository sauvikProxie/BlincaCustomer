// Reactive status for a LIST of restaurants (the grid) with ONE shared timer
// that wakes at the earliest `nextChangeAt` across the list — not one timer per
// card. Same shared compute and skew correction as useRestaurantStatus.
import { browser } from '$app/env';
import {
	canOrderLater,
	canOrderNow,
	isTimeDriven,
	restaurantStatusAt
} from '#lib/status/compute.js';
import type { RestaurantStatus, RestaurantStatusInput } from '#lib/types/status.js';

export type ListEntry = { id: string; input: RestaurantStatusInput };

export type RestaurantListStatusItem = {
	id: string;
	status: RestaurantStatus;
	nextChangeAt: number | null;
	canOrderNow: boolean;
	canOrderLater: boolean;
};

export type RestaurantListStatusView = {
	readonly items: RestaurantListStatusItem[];
};

export function useRestaurantListStatus(getList: () => ListEntry[]): RestaurantListStatusView {
	let offset = $state(0);
	let now = $state(browser ? Date.now() : 0);

	const items = $derived.by((): RestaurantListStatusItem[] =>
		getList().map((entry) => {
			const computed = isTimeDriven(entry.input.status)
				? restaurantStatusAt(entry.input.hours, entry.input.pausedUntil ?? undefined, now)
				: { status: entry.input.status, nextChangeAt: entry.input.nextChangeAt };
			return {
				id: entry.id,
				status: computed.status,
				nextChangeAt: computed.nextChangeAt,
				canOrderNow: canOrderNow(computed.status),
				canOrderLater: canOrderLater(computed.status)
			};
		})
	);

	// Skew from the first entry; all entries of one list query share a serverNow.
	$effect(() => {
		const list = getList();
		if (!browser || list.length === 0) return;
		offset = (list[0]!.input.serverNow ?? Date.now()) - Date.now();
		now = Date.now() + offset;
	});

	// One timer for the whole list, set to the earliest upcoming change.
	$effect(() => {
		if (!browser) return;
		const times = items.map((i) => i.nextChangeAt).filter((t): t is number => t != null);
		if (times.length === 0) return;
		const delay = Math.max(0, Math.min(...times) - (Date.now() + offset));
		const id = setTimeout(() => {
			now = Date.now() + offset;
		}, delay + 50);
		return () => clearTimeout(id);
	});

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
		get items() {
			return items;
		}
	};
}
