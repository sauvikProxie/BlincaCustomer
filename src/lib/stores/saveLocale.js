/* Saves the customer's language (customers.setLocale) so order emails use it.
   Awaited by setLang for at most SAVE_TIMEOUT_MS: a fire-and-forget request
   could be killed by the reload that follows. Errors and timeouts are ignored
   (dev log only); signed-out visitors save nothing and are saved at login. */
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@blinca/backend/convex/_generated/api';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { isDesignCheck, isLoggedIn, sessionCache } from './session.svelte.js';

export const SAVE_TIMEOUT_MS = 400;

/**
 * Resolves with the promise's value, or `fallback` after `ms`.
 * @template T
 * @param {Promise<T>} promise @param {number} ms @param {T} fallback
 * @returns {Promise<T>}
 */
export function raceTimeout(promise, ms, fallback) {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(fallback), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve(fallback);
			}
		);
	});
}

async function save(/** @type {'sv'|'en'} */ locale) {
	const res = await sessionCache.authClient?.convex?.token({ fetchOptions: { throw: false } });
	const token = res?.data?.token ?? null;
	if (!token) return false;
	const http = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	http.setAuth(token);
	await http.mutation(api.customers.setLocale, { locale });
	return true;
}

/**
 * @param {'sv'|'en'} locale
 * @param {{ force?: boolean }} [opts] force: skip the signed-in check (right after login, before the session store updates)
 * @returns {Promise<boolean>} true when saved
 */
export async function saveLocale(locale, opts = {}) {
	if (isDesignCheck() || !sessionCache.authClient) return false;
	if (!opts.force && !isLoggedIn()) return false;
	try {
		return await raceTimeout(
			save(locale).catch((e) => {
				if (import.meta.env.DEV) console.warn('[locale] save failed', e);
				return false;
			}),
			SAVE_TIMEOUT_MS,
			false
		);
	} catch {
		return false;
	}
}
