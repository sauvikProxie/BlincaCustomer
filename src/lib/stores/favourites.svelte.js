/* Blinca – favourites store.
   Design-check: localStorage verbatim.
   Real mode: listMyFavorites / toggleFavorite (restaurant id ↔ slug via catalog).
   Empty when logged out. toggleFav stays sync (optimistic) and fires the
   Convex mutation in the background; the subscription refresh corrects it. */
import { read, write } from './core.svelte.js';
import { restaurant } from './catalog.svelte.js';
import { isDesignCheck, isLoggedIn } from './session.svelte.js';

/** @type {string[]} slug cache from backend, set by root subscription layer. */
let backendSlugs = $state([]);
/** @param {any[]} rows listMyFavorites rows */
export function setFavoritesCache(rows) {
	backendSlugs = (rows || []).map((r) => r.slug).filter(Boolean);
}
/** Registered Convex toggle fn (layout provides useMutation). @type {((args:any)=>Promise<any>)|null} */
let toggleMut = null;
/** @param {(args:any)=>Promise<any>} fn */
export function setFavoriteMutation(fn) {
	toggleMut = fn || null;
}
/** Resolve slug → restaurantId for the mutation. @param {string} slug */
function restaurantIdFor(slug) {
	const r = restaurant(slug);
	return r && r._restaurantId ? r._restaurantId : null;
}

/** @returns {string[]} */
export function favorites() {
	if (isDesignCheck()) return read('favorites', []);
	if (!isLoggedIn()) return [];
	return backendSlugs.slice();
}

/** @param {string} slug */
export function isFav(slug) {
	return favorites().indexOf(slug) !== -1;
}

/** @param {string} slug @returns {boolean} true when added */
export function toggleFav(slug) {
	if (isDesignCheck()) {
		const f = favorites();
		const i = f.indexOf(slug);
		if (i === -1) f.push(slug);
		else f.splice(i, 1);
		write('favorites', f);
		return i === -1;
	}
	if (!isLoggedIn()) return false;
	const adding = backendSlugs.indexOf(slug) === -1;
	if (adding) backendSlugs = [...backendSlugs, slug];
	else backendSlugs = backendSlugs.filter((s) => s !== slug);
	const rid = restaurantIdFor(slug);
	if (rid && toggleMut) {
		toggleMut({ restaurantId: rid }).catch((e) => console.warn('[fav] toggle failed', e));
	}
	return adding;
}
