/**
 * Content-Security-Policy for the customer site. Sent as Report-Only first: it
 * never blocks anything, so a wrong source only shows up as a console report.
 * Origins that differ per environment come from env (Convex URL, extra image
 * hosts, the checkout host); the fixed Mapbox hosts are the public service
 * domains the map libraries call.
 */

export type CspInput = {
	/** PUBLIC_CONVEX_URL: HTTP origin for queries and image storage, derived ws(s) origin for the live socket. */
	convexUrl: string;
	/** Space-separated extra image origins. */
	extraImgHosts?: string;
	/** Space-separated origins a navigation or form may go to (Mollie checkout). */
	formActionHosts?: string;
};

const MAPBOX_API = ['https://api.mapbox.com', 'https://events.mapbox.com'];
const MAPBOX_TILES = 'https://*.tiles.mapbox.com';

function words(list: string | undefined): string[] {
	return (list ?? '').split(/\s+/).filter((h) => /^https?:\/\/[^\s;,']+$/.test(h));
}

/** [http origin, ws origin] for a Convex URL; empty when it is not a valid URL. */
export function convexOrigins(convexUrl: string): string[] {
	try {
		const u = new URL(convexUrl);
		const ws = u.protocol === 'https:' ? 'wss:' : 'ws:';
		return [u.origin, `${ws}//${u.host}`];
	} catch {
		return [];
	}
}

export function contentSecurityPolicy(input: CspInput): string {
	const [convexHttp, convexWs] = convexOrigins(input.convexUrl);
	const convex = [convexHttp, convexWs].filter((o): o is string => !!o);
	const directives: Record<string, string[]> = {
		'default-src': ["'self'"],
		// SvelteKit's bootstrap script and the theme script in app.html are inline.
		// Tighten to hashes/nonces once the reports show nothing else needs it.
		'script-src': ["'self'", "'unsafe-inline'"],
		'style-src': ["'self'", "'unsafe-inline'"],
		'img-src': [
			"'self'",
			'data:',
			'blob:',
			...(convexHttp ? [convexHttp] : []),
			...MAPBOX_API.slice(0, 1),
			MAPBOX_TILES,
			...words(input.extraImgHosts)
		],
		'font-src': ["'self'", 'data:'],
		'connect-src': ["'self'", ...convex, ...MAPBOX_API, MAPBOX_TILES],
		'worker-src': ["'self'", 'blob:'],
		'child-src': ['blob:'],
		'object-src': ["'none'"],
		'base-uri': ["'self'"],
		'frame-ancestors': ["'none'"],
		'form-action': ["'self'", ...words(input.formActionHosts)],
		// Same-origin endpoint that logs violations (routes/csp-report).
		'report-uri': ['/csp-report']
	};
	return Object.entries(directives)
		.map(([name, sources]) => `${name} ${sources.join(' ')}`)
		.join('; ');
}
