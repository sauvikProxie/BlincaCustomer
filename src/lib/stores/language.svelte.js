/* Blinca language engine — the source's t()/lang()/setLang() API, backed by
   Paraglide instead of the source i18n tables. Every source key maps to a
   `src_<key>` Paraglide message (generated from the source en.js/sv.js with the
   exact same text), so rendered strings are identical. One i18n system. */
import { getLocale, setLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { isLoggedIn } from './session.svelte.js';

/** @returns {'en' | 'sv'} */
export function lang() {
	return getLocale() === 'en' ? 'en' : 'sv';
}

/** @param {string} l */
export async function setLang(l) {
	if (l !== 'en' && l !== 'sv') return;
	if (l === getLocale()) return;
	// A signed-in customer's choice is saved first (waits at most ~400 ms, errors
	// ignored) because the reload below would kill a fire-and-forget request.
	// Signed out: nothing to save, so the switch stays synchronous. saveLocale is
	// imported on demand because it needs the app env, which this store's many importers (and tests) do not.
	if (isLoggedIn()) {
		const { saveLocale } = await import('./saveLocale.js');
		await saveLocale(l);
	}
	// Paraglide's cookie is the source of truth; setLocale reloads so every
	// message re-renders in the new locale (the one behavioural difference from
	// the source's in-place switch — the final rendered state is identical).
	setLocale(l);
}

/** Like t(), but '' (and no console warning) for a key that does not exist. */
/** @param {string} key */
export function tOptional(key) {
	const name = 'src_' + key.replace(/[.\-]/g, '_');
	return name in m ? t(key) : '';
}

/**
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 * @returns {string}
 */
export function t(key, vars) {
	const name = 'src_' + key.replace(/[.\-]/g, '_');
	const fn = /** @type {Record<string, (i?: any) => string>} */ (m)[name];
	if (typeof fn !== 'function') {
		if (typeof console !== 'undefined') console.warn('[i18n] missing key: ' + key);
		return key;
	}
	// Paraglide treats every {x} in a message as a parameter. The source code,
	// though, leaves some {x} literal and splits/replaces them itself (e.g. the
	// login "accept our {terms} and {privacy}" line). So for any placeholder the
	// caller didn't supply, return the literal "{x}" instead of undefined.
	const given = vars ?? {};
	const inputs = new Proxy(given, {
		get: (t, p) => (p in t ? t[p] : '{' + String(p) + '}'),
		has: () => true
	});
	return fn(inputs);
}
