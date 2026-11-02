/* Blinca – shared formatting / lookup helpers (ported 1:1 from components.js).
   Svelte auto-escapes, so there is no esc() here; localize via #lib/i18n.js. */
import { getSiteData } from './stores/catalog.svelte.js';
import { formatMoney, toCents, formatAmount } from './money.js';
import { m } from '#lib/paraglide/messages.js';

/** @param {import('./types.js').LocalizedText|string|null|undefined} v @param {string} lang @returns {string} */
export function L(v, lang) {
	if (v == null) return '';
	if (typeof v === 'string') return v;
	const m = /** @type {Record<string, string>} */ (v);
	return m[lang] != null ? m[lang] : v.en;
}

/** @param {number} n */
export const kr = (n) => formatMoney(toCents(n));

/** A dish's price: "from X kr" when it has sizes (`from`: `price` is the cheapest), else "X kr".
 *  @param {{ price: number, from?: boolean }} it */
export const dishPrice = (it) => (it.from ? m.rest_from_price({ price: kr(it.price) }) : kr(it.price));

/** Shop-local time: orders belong to Stockholm whatever the browser's zone is. */
const TZ = 'Europe/Stockholm';
/** @param {string} lang 'sv'/'en' or a BCP-47 tag */
const tag = (lang) => (lang.startsWith('sv') ? 'sv-SE' : 'en-GB');

/** @param {number|string|Date} when @param {string} lang */
export const fmtTime = (when, lang) =>
	new Date(when).toLocaleTimeString(tag(lang), { hour: '2-digit', minute: '2-digit', timeZone: TZ });

/** @param {number|string|Date} when @param {string} lang @param {Intl.DateTimeFormatOptions} [opts] */
export const fmtDate = (when, lang, opts = { day: 'numeric', month: 'short' }) =>
	new Date(when).toLocaleDateString(tag(lang), { ...opts, timeZone: TZ });

/** A priced amount, or "…" while the checkout preview has not answered yet.
 *  @param {{ loading?: boolean }} pr @param {number} n kronor */
export const prKr = (pr, n) => (pr.loading ? '…' : kr(n));

/** Kronor → "12,50". @param {number} n */
export const decimal = (n) => formatAmount(toCents(n));

/** @param {unknown} s */
export const norm = (s) =>
	String(s || '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');

/** @param {string} id @returns {import('./types.js').Cuisine|undefined} */
export function cuisine(id) {
	return getSiteData().cuisines.find((c) => c.id === id);
}

/** @param {{ cuisines: string[] }} r @param {string} lang @returns {string} */
export function cuisineNames(r, lang) {
	return r.cuisines
		.map((c) => {
			const cu = cuisine(c);
			return cu ? L(cu.name, lang) : '';
		})
		.join(' · ');
}

/** @param {number} n */
export const priceLevel = (n) => new Array(n + 1).join('kr ').trim();

/** 'YYYY-MM-DD' on the local calendar, the form backend special days use.
 *  @param {Date} d */
export function dateKey(d) {
	return (
		d.getFullYear() +
		'-' +
		String(d.getMonth() + 1).padStart(2, '0') +
		'-' +
		String(d.getDate()).padStart(2, '0')
	);
}

/** The [open, close] ranges open on a date: a special day replaces the weekday
 *  row, and an empty list means closed (either way there is nothing that day).
 *  @param {{ hours: (string[]|null)[], specialDays?: { date: string, ranges: string[][] }[] }} r
 *  @param {Date} d @returns {string[][]} */
export function dayRanges(r, d) {
	const special = (r.specialDays || []).find((s) => s.date === dateKey(d));
	const ranges = special ? special.ranges : [r.hours[(d.getDay() + 6) % 7]];
	return (ranges || []).filter(Boolean);
}

/** @param {{ deliverable?: boolean, city?: string } | null} a */
export function deliverable(a) {
	return (
		!!a &&
		(a.deliverable === true ||
			(a.deliverable == null && /stockholm|solna|sundbyberg|nacka/.test(norm(a.city))))
	);
}

/* ---------- routes (new URLs; old .html URLs redirect, see hooks + error page) ---------- */
/** @param {string} slug @param {string} [itemId] */
export const restaurantUrl = (slug, itemId) =>
	`/restaurants/${encodeURIComponent(slug)}${itemId ? `#item-${itemId}` : ''}`;
/** @param {string} [q] */
export const homeUrl = (q) => `/${q ? `?q=${encodeURIComponent(q)}` : ''}#all-restaurants`;
/** @param {string} page @param {string} [tab] */
export const infoUrl = (page, tab) => `/info/${page}${tab ? `?tab=${tab}` : ''}`;
export const checkoutUrl = () => '/checkout';
/** @param {string} [next] */
export const loginUrl = (next) => `/login${next ? `?next=${encodeURIComponent(next)}` : ''}`;
