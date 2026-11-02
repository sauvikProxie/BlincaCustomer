/* checkout.preview / placeOrder issue codes → customer text, in one place. */
import { m } from '#lib/paraglide/messages.js';
import { t } from '#lib/stores/language.svelte.js';

/**
 * @param {string} code backend issue/error code
 * @param {{ name?: string, shortfallCents?: number }} [ctx]
 * @returns {string | null} null for codes this helper does not own (e.g. PROMO_INVALID)
 */
export function issueText(code, ctx = {}) {
	switch (code) {
		case 'ADDRESS_INVALID':
			return m.co_address_invalid();
		case 'POSTAL_CODE_NOT_SERVED':
			return m.co_zone_bad();
		case 'FULFILLMENT_NOT_SUPPORTED':
			return m.co_fulfillment_unsupported();
		case 'SCHEDULED_TIME_INVALID':
		case 'SCHEDULED_TIME_OUTSIDE_HOURS':
			return m.co_slot_invalid();
		case 'RESTAURANT_CLOSED':
		case 'RESTAURANT_PAUSED':
		case 'RESTAURANT_UNAVAILABLE':
			return t('rest.notTaking', { name: ctx.name ?? '' });
		case 'BELOW_MINIMUM_ORDER':
			// The backend reports the gap in öre; round up so the advice reaches the minimum.
			return t('rest.minLeft', { n: Math.ceil((ctx.shortfallCents ?? 0) / 100) });
		case 'ITEM_REMOVED':
			return m.cart_issue_removed();
		case 'ITEM_SOLD_OUT':
			return m.cart_reason_item_unavailable();
		case 'CART_EMPTY':
			return m.cart_empty_title();
		default:
			return null;
	}
}

/** Slot instants (ms) → select options labelled in Stockholm time.
 *  @param {number[]} instants @param {string} lang @param {number} now
 *  @param {(when: number, lang: string, o?: any) => string} fmtDate @param {(when: number, lang: string) => string} fmtTime
 *  @returns {Array<{ v: string, l: string }>} */
export function slotOptions(instants, lang, now, fmtDate, fmtTime) {
	const day = (/** @type {number} */ ms) =>
		fmtDate(ms, 'en', { year: 'numeric', month: '2-digit', day: '2-digit' });
	const today = day(now);
	const tomorrow = day(now + 24 * 3600_000);
	return (instants || []).map((ms) => {
		const d = day(ms);
		const label =
			d === today
				? t('co.today')
				: d === tomorrow
					? t('co.tomorrow')
					: fmtDate(ms, lang, { weekday: 'short', day: 'numeric', month: 'short' });
		return { v: String(ms), l: `${label} ${fmtTime(ms, lang)}` };
	});
}
