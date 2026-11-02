/* Blinca – offers: the one source for the home Deals, the drawer, the popup and
   the NEW badges, through offers()/activeOffers().
   Design-check: SiteData.offers verbatim + localStorage seen/opened by code.
   Real mode: marketplace.listPublicOffers (public: signed-out visitors see the
   same offers) mapped to the source Offer shape. Seen/opened are keyed by the
   banner id (offerKey); `code` is set only when the banner shows its code
   publicly. Nothing active means nothing to show. */
import { browser } from '#app/env';
import { read, write } from './core.svelte.js';
import { getSiteData } from './catalog.svelte.js';
import { isDesignCheck } from './session.svelte.js';

/** @type {any[]} backend-mapped cache */
let backendOffers = $state([]);

const THEMES = { brand: 'red', pink: 'pink', dark: 'dark' };

/** Banner theme → existing card theme; anything unknown falls back to the kind's default. @param {any} p */
export function offerTheme(p) {
	const known = /** @type {Record<string, string>} */ (THEMES)[p.theme];
	if (known) return known;
	return p.kind === 'free_delivery' ? 'red' : p.kind === 'student' ? 'pink' : 'dark';
}

/** listPublicOffers row → the source Offer shape. @param {any} p */
export function mapPublicOffer(p) {
	return {
		id: String(p.id),
		// Only a publicly shown code can be copied; otherwise the card has none.
		code: p.code || null,
		theme: offerTheme(p),
		image: p.imageUrl || null, // Img shows the plate placeholder
		slug: p.restaurantSlug || undefined,
		endsAt: p.endsAt ? new Date(p.endsAt).toISOString() : undefined,
		rule: { type: 'info' },
		title: { en: p.titleEn || '', sv: p.titleSv || '' },
		text: { en: p.subtitleEn || '', sv: p.subtitleSv || '' }
	};
}

/** @param {any[]} rows listPublicOffers rows */
export function setOffersCache(rows) {
	backendOffers = (rows || []).map(mapPublicOffer);
}

/** Stable identity of an offer: the banner id (design-check offers have only a code). @param {any} o */
export function offerKey(o) {
	return o.id ?? o.code;
}

/** @returns {any[]} */
export function offers() {
	if (isDesignCheck()) return getSiteData().offers || [];
	return backendOffers;
}

/** Offers to show anywhere: the source's offers that are active now. @returns {any[]} */
export function activeOffers() {
	return offers().filter(isActive);
}

/** Active now: honor optional dates if a future API adds them; default true. @param {any} o */
export function isActive(o) {
	const now = Date.now();
	const start = o.startsAt ? Date.parse(o.startsAt) : null;
	const end = o.endsAt || o.end ? Date.parse(o.endsAt || o.end) : null;
	if (start != null && !Number.isNaN(start) && now < start) return false;
	if (end != null && !Number.isNaN(end) && now >= end) return false;
	return true;
}

/** @returns {string[]|null} */
function seen() {
	return read('seenOffers', null);
}
/** @returns {string[]} */
function opened() {
	return read('openedOffers', []);
}

/** First-visit baseline: mark every current offer seen + opened, no popup. */
export function ensureInit() {
	if (seen() !== null) return;
	const all = offers().map(offerKey);
	// Real mode: offers arrive after mount. Baseline once they are here, not against an empty
	// list, or every existing offer would pop up as "new" on a first visit.
	if (!all.length && !isDesignCheck()) return;
	write('seenOffers', all);
	write('openedOffers', all);
}

/** Offers that should trigger the popup (active + never seen). @returns {any[]} */
export function newOffers() {
	const s = seen();
	if (s === null) return []; // not initialised yet → ensureInit() runs first on mount
	return offers().filter((o) => isActive(o) && !s.includes(offerKey(o)));
}

/** @param {string} code */
export function markSeen(code) {
	const s = seen() || [];
	if (!s.includes(code)) write('seenOffers', [...s, code]);
}

/** @param {string[]} codes */
export function markAllSeen(codes) {
	const s = seen() || [];
	const add = codes.filter((c) => !s.includes(c));
	if (add.length) write('seenOffers', [...s, ...add]);
}

/** Opened = customer engaged (opened/copied/ordered); clears the NEW state. @param {string} code */
export function markOpened(code) {
	markSeen(code);
	const o = opened();
	if (!o.includes(code)) write('openedOffers', [...o, code]);
}

/** NEW = active + not yet engaged. @param {any} o */
export function isNew(o) {
	return isActive(o) && !opened().includes(offerKey(o));
}

export function hasNew() {
	return offers().some((o) => isNew(o));
}

export function newCount() {
	return offers().filter((o) => isNew(o)).length;
}

/* "Show" highlight: which card to flash after the toast link. */
export const flash = $state({ key: '' });
let flashTimer = 0;
/** @param {string} key */
export function flashOffer(key) {
	flash.key = key;
	if (browser) {
		clearTimeout(flashTimer);
		flashTimer = window.setTimeout(() => (flash.key = ''), 1600);
	}
}
