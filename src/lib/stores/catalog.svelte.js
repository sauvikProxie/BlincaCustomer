/* Blinca – restaurant/menu catalog lookups (ported 1:1 from store.js).
   Reads the site dataset, which +layout.js may replace with live API data. */
import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { browser } from '#app/env';
import { DATA } from '#lib/data.js';

// Reactive so a restaurant's full menu can replace its lightweight card entry.
let current = $state(DATA);

/** @param {any} d */
export function setSiteData(d) {
	if (d) current = d;
}

/** @returns {import('#lib/types.js').SiteData} */
export function getSiteData() {
	return current;
}

/** @param {string} slug @returns {import('#lib/types.js').Restaurant|null} */
function find(slug) {
	const list = current.restaurants;
	for (let i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
	return null;
}

/** @type {Map<string, Promise<void>>} */
const lookups = new Map();
/** Slugs `getBySlug` said do not exist (the page shows "not found" only for these). */
const gone = new SvelteSet();

/** @param {string} slug */
export function restaurantGone(slug) {
	return gone.has(slug);
}

/** A restaurant missing from the cached list (the list is capped, see B1) is loaded
 *  by slug once and merged into it. No-op in design-check (the dataset is complete).
 *  @param {string} slug @returns {Promise<void>} */
export function ensureRestaurant(slug) {
	if (!slug || find(slug) || current === DATA || gone.has(slug)) return Promise.resolve();
	let p = lookups.get(slug);
	if (!p) {
		p = import('#lib/api.js')
			.then((m) => m.loadRestaurantBySlug(slug))
			.then((full) => {
				if (!full) gone.add(slug);
				else if (!find(slug)) current.restaurants.push(full);
			})
			.catch((e) => console.error('[catalog] restaurant lookup failed', slug, e))
			.finally(() => lookups.delete(slug));
		lookups.set(slug, p);
	}
	return p;
}

/** The restaurant from the list, or (once, in the background) by slug when it is not in it.
 *  @param {string} slug @returns {import('#lib/types.js').Restaurant|null} */
export function restaurant(slug) {
	const r = find(slug);
	// Started in a microtask: this is often called inside $derived, and the lookup writes state when it ends.
	if (!r && browser && slug) queueMicrotask(() => void ensureRestaurant(slug));
	return r;
}

/** Replace (or add) a restaurant with fresher data, e.g. from the page's live subscriptions.
 *  Untracked: callers are effects that must not re-run on the write.
 *  @param {string} slug @param {any} full */
export function setLiveRestaurant(slug, full) {
	if (!full) return;
	untrack(() => {
		const i = current.restaurants.findIndex((x) => x.slug === slug);
		if (i >= 0) current.restaurants[i] = full;
		else if (current !== DATA) current.restaurants.push(full);
	});
}

/** @type {Map<string, Promise<void>>} */
const inflight = new Map();
/** Slugs whose last menu load failed; the restaurant page shows an error + retry for these. */
const failed = new SvelteSet();

/** @param {string} slug */
export function menuFailed(slug) {
	return failed.has(slug);
}

/** Load a restaurant's full menu (options, hours, availability) once; a no-op for
 *  entries that already have it. Resolves even if the load fails: the failure is
 *  logged and recorded for `menuFailed`, and calling this again retries.
 *  @param {string} slug @returns {Promise<void>} */
export function ensureMenu(slug) {
	const r = /** @type {any} */ (restaurant(slug));
	if (!r?._lite) return Promise.resolve();
	failed.delete(slug);
	let p = inflight.get(slug);
	if (!p) {
		// Dynamic: api.js needs the SvelteKit env, which store unit tests do not have.
		p = import('#lib/api.js')
			.then((m) => m.loadRestaurantFull(r._card))
			.then((full) => {
				const i = current.restaurants.findIndex((x) => x.slug === slug);
				if (full && i >= 0) current.restaurants[i] = full;
			})
			.catch((e) => {
				console.error('[catalog] menu load failed', slug, e);
				failed.add(slug);
			})
			.finally(() => inflight.delete(slug));
		inflight.set(slug, p);
	}
	return p;
}

/** @param {string} slug @param {string} itemId @returns {import('#lib/types.js').Dish} */
export function item(slug, itemId) {
	const r = restaurant(slug);
	if (!r) return /** @type {any} */ (null);
	for (let c = 0; c < r.menu.length; c++) {
		const items = r.menu[c].items;
		for (let i = 0; i < items.length; i++) if (items[i].id === itemId) return items[i];
	}
	return /** @type {any} */ (null);
}

/** @param {Record<string, string[]>} [opts] @returns {Record<string, string[]>} */
export function normOpts(opts) {
	/** @type {Record<string, string[]>} */
	const out = {};
	Object.keys(opts || {})
		.sort()
		.forEach((g) => {
			const arr = ((opts || {})[g] || []).slice().sort();
			if (arr.length) out[g] = arr;
		});
	return out;
}

/** @param {string} slug @param {string} itemId @param {Record<string, string[]>} [opts] @param {string} [note] */
export function keyFor(slug, itemId, opts, note) {
	return slug + '|' + itemId + '|' + JSON.stringify(normOpts(opts)) + (note ? '|' + note : '');
}

/** @param {string} slug @param {string} itemId @param {Record<string, string[]>} [opts] */
export function unitPrice(slug, itemId, opts) {
	const it = item(slug, itemId);
	if (!it) return 0;
	let p = it.price;
	(it.options || []).forEach((g) => {
		const chosen = (opts && opts[g.id]) || [];
		g.choices.forEach((c) => {
			// A size's price is the item's price, not an add-on.
			if (chosen.indexOf(c.id) !== -1) p = g.variant ? c.price : p + c.price;
		});
	});
	return p;
}
