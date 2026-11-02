import { m } from '#lib/paraglide/messages.js';
import { fmtDate } from '#lib/format.js';

/**
 * Why a dish cannot be ordered right now, in the active language; '' when it can.
 * `availability` is the backend's per-item state (lightweight grid dishes have
 * none, which counts as available). A timed state that has already lapsed is
 * available again, without waiting for the live menu to refresh.
 * @param {{ kind?: string, until?: number, nextAvailableAt?: number } | null | undefined} availability
 * @param {string} lang @param {number} [now]
 * @returns {string}
 */
export function itemUnavailable(availability, lang, now = Date.now()) {
	switch (availability?.kind) {
		case 'sold_out_today':
			return m.item_status_sold_out_today();
		case 'sold_out_until':
			if (availability.until != null && availability.until <= now) return '';
			return m.item_status_sold_out_until({ date: fmtDate(availability.until ?? now, lang) });
		case 'sold_out_indefinitely':
			return m.item_status_sold_out();
		case 'outside_schedule':
			if (availability.nextAvailableAt != null && availability.nextAvailableAt <= now) return '';
			return m.item_status_outside_schedule();
		default:
			return '';
	}
}
