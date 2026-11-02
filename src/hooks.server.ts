import { sequence } from '@sveltejs/kit/hooks';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { createAuthProxyHandle } from '@blinca/auth/server';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { CONVEX_SITE_URL, CSP_IMG_HOSTS, CSP_FORM_ACTION_HOSTS } from '$app/env/private';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { contentSecurityPolicy } from '#lib/csp.js';
import { isNonProductionHost } from '#lib/nonProduction.js';

/** Built once at startup: the origins come from env and do not change per request. */
const csp = contentSecurityPolicy({
	convexUrl: PUBLIC_CONVEX_URL,
	extraImgHosts: CSP_IMG_HOSTS,
	formActionHosts: CSP_FORM_ACTION_HOSTS
});

/**
 * The same security headers as the project-root `_headers` file. Cloudflare
 * only applies `_headers` rules to responses served from the static ASSETS
 * layer (true static files, and prerendered routes baked to static HTML at
 * build time) — a response this Worker builds itself at request time, like
 * /login's SSR'd HTML or the /api/auth/* proxy, never passes through that
 * layer and would otherwise ship with none of them. Setting them here,
 * first in the sequence so it wraps every other handle, closes that gap:
 * every dynamic response gets them regardless of which handle produced it.
 *
 * The CSP report-only header is Worker-only (its origins come from env), so it
 * is deliberately not duplicated in `_headers`.
 *
 * Keep the other four in sync with `_headers` by hand — there is no single source of
 * truth shared between a Cloudflare platform file and server code.
 */
const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
	);
	response.headers.set('X-Frame-Options', 'DENY');
	// Report-Only: violations show in the browser console, nothing is blocked.
	// No report-to endpoint exists yet. See docs/DEPLOY.md before enforcing.
	response.headers.set('Content-Security-Policy-Report-Only', csp);
	if (isNonProductionHost(event.url.hostname)) {
		response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	}
	return response;
};

/**
 * Resolves the locale for the request (cookie, then Accept-Language, then
 * Swedish) and stamps it into <html lang>. Runs after the auth proxy, which
 * returns early for /api/auth/* and so never reaches this.
 */
const handleParaglide: Handle = ({ event, resolve }) =>
	// The original `event` is passed through rather than the middleware's
	// rewritten request: no locale appears in the URL (the strategy is
	// cookie / Accept-Language only), so there is nothing to de-localize.
	paraglideMiddleware(event.request, ({ locale }) =>
		resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		})
	);

export const handle = sequence(
	handleSecurityHeaders,
	createAuthProxyHandle({ convexSiteUrl: CONVEX_SITE_URL, accountType: 'customer' }),
	handleParaglide
);

/**
 * Logs unexpected server errors as one JSON line (Workers observability picks
 * it up) and hands the visitor an id to quote. Expected errors (404s, error()
 * calls) are not logged. Only the path is logged, never the query string:
 * reset and invite links carry tokens there.
 */
export const handleError: HandleServerError = ({ kind, error, event }) => {
	const errorId = crypto.randomUUID();
	if (kind === 'unknown') {
		console.error(
			JSON.stringify({
				errorId,
				method: event.request.method,
				path: event.url.pathname,
				route: event.route.id,
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			})
		);
	}
	return { errorId };
};
