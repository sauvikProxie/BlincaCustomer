// Reactive item availability. A `sold_out_until` or `outside_schedule` item
// flips back at its boundary, and a `sold_out_today` item flips at the next
// 04:00 Stockholm stock reset — using the shared `nextBusinessDayStart`. One
// timer to the boundary; SSR-safe. The live menu subscription supplies any
// richer re-evaluation (e.g. an available item going outside a schedule).
import { browser } from '$app/env';
import { nextBusinessDayStart } from '@blinca/backend/stockholmTime';
import type { ItemAvailability } from '#lib/types/status.js';

export type ItemAvailabilityInput = {
	availability: ItemAvailability;
	serverNow: number;
};

export type ItemAvailabilityView = {
	readonly availability: ItemAvailability;
	readonly boundary: number | null;
};

const AVAILABLE: ItemAvailability = { kind: 'available' };

/** The instant at which the current availability lapses back to available. */
function boundaryOf(availability: ItemAvailability, now: number): number | null {
	switch (availability.kind) {
		case 'sold_out_until':
			return availability.until;
		case 'outside_schedule':
			return availability.nextAvailableAt ?? null;
		case 'sold_out_today':
			return nextBusinessDayStart(now);
		default:
			return null;
	}
}

export function useItemAvailability(
	getInput: () => ItemAvailabilityInput | null | undefined
): ItemAvailabilityView {
	let offset = $state(0);
	let now = $state(browser ? Date.now() : 0);

	const input = $derived(getInput() ?? null);
	const boundary = $derived(input ? boundaryOf(input.availability, now) : null);
	const availability = $derived.by((): ItemAvailability => {
		if (!input) return AVAILABLE;
		if (boundary != null && now >= boundary) return AVAILABLE;
		return input.availability;
	});

	$effect(() => {
		const i = getInput();
		if (!browser || !i) return;
		offset = i.serverNow - Date.now();
		now = Date.now() + offset;
	});

	$effect(() => {
		if (!browser) return;
		const b = boundary;
		if (b == null) return;
		const delay = Math.max(0, b - (Date.now() + offset));
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
		get availability() {
			return availability;
		},
		get boundary() {
			return boundary;
		}
	};
}
