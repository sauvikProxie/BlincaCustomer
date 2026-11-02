/* Blinca – localStorage persistence (same keys the live site uses: blinca.v1.*).
   Every read touches the reactive revision so Svelte re-renders on change;
   every write bumps it. SSR-safe: outside the browser, reads return defaults
   and writes only touch memory. */
import { browser } from '#app/env';

export const PREFIX = 'blinca.v1.';

/** @type {Record<string, any>} */
const memory = {};

/** Reactive revision counter shared by all stores. */
export const rev = $state({ v: 0 });

/** Subscribe the current computation to store changes. */
export function touch() {
	void rev.v;
}

function bump() {
	rev.v++;
}

/** Wake every store reader (all `read()`s subscribe to `rev`). Call after
 *  async backend refreshes that write `$state` caches outside effects. */
export function poke() {
	bump();
}

/** @param {any} o */
export function clone(o) {
	return o === undefined ? o : JSON.parse(JSON.stringify(o));
}

/**
 * @param {string} key
 * @param {any} def
 */
export function read(key, def) {
	touch();
	if (!browser) return clone(def);
	try {
		const v = window.localStorage.getItem(PREFIX + key);
		return v == null ? clone(def) : JSON.parse(v);
	} catch {
		return Object.prototype.hasOwnProperty.call(memory, key) ? clone(memory[key]) : clone(def);
	}
}

/**
 * @param {string} key
 * @param {any} value
 */
export function write(key, value) {
	memory[key] = clone(value);
	if (browser) {
		try {
			window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
		} catch {
			/* private mode */
		}
	}
	bump();
}

/** Seed the demo state on first visit (design-check only).
 * Real mode never seeds: data comes from Convex, user from Better Auth.
 * @param {() => any} getData
 * @param {(...args: any[]) => any} keyFor
 * @param {(...args: any[]) => any} normOpts
 */
export function seedIfNeeded(getData, keyFor, normOpts) {
	let design = false;
	if (!import.meta.env.DEV) return;
	try {
		const v = import.meta.env.VITE_DESIGN_CHECK;
		design = v === '1' || v === 1 || v === true || v === 'true';
	} catch {
		design = false;
	}
	if (!design) return;
	if (read('seeded', false)) return;
	const D = getData();
	write(
		'cart',
		D.seed.cart.map((/** @type {any} */ l) => ({
			key: keyFor(l.slug, l.itemId, l.opts),
			slug: l.slug,
			itemId: l.itemId,
			opts: normOpts(l.opts),
			qty: l.qty
		}))
	);
	write('orders', clone(D.seed.orders));
	write('favorites', clone(D.seed.favorites));
	write('address', D.seed.address);
	if (read('lang', null) == null) write('lang', 'en');
	write('user', { name: 'Anna Svensson', email: 'anna@example.se', phone: '70 123 45 67' });
	write('myAddresses', []);
	write('promo', null);
	write('mode', 'delivery');
	write('seeded', true);
}

/** Keep tabs in sync: any blinca.v1.* change in another tab re-renders. */
export function attachTabSync() {
	if (!browser || attachTabSync.done) return;
	attachTabSync.done = true;
	window.addEventListener('storage', (e) => {
		if (e.key && e.key.indexOf(PREFIX) === 0) bump();
	});
}
attachTabSync.done = false;
