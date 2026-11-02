/** Where a customer lands when nothing else was asked for (the home). */
const DASHBOARD = '/';

/**
 * `?next=` decides where a successful sign-in lands. Only same-origin
 * absolute paths are accepted: a protocol-relative `//evil.test`, a backslash
 * variant (browsers read `\` as `/`), control characters (stripped by URL
 * parsers) or a full URL would turn the login form into an open redirect.
 */
/** @param {string|null} raw @returns {string} */
export function safeNext(raw) {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return DASHBOARD;
	if ([...raw].some((c) => c === '\\' || c.charCodeAt(0) < 32)) return DASHBOARD;
	return raw;
}

/**
 * The sign-in redirect keeps the page's #fragment (e.g. #rate from an email link)
 * in the browser but not in ?next=; put it back unless `next` has its own.
 * @param {string} next a safeNext() result @param {string} hash location.hash
 */
export function withHash(next, hash) {
	return hash.length > 1 && !next.includes('#') ? next + hash : next;
}
