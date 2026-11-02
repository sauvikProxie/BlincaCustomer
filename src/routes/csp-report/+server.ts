import type { RequestHandler } from './$types';

/**
 * Receives the browser's Content-Security-Policy violation reports (the
 * policy is Report-Only, see hooks.server.ts) and writes one line each to the
 * Workers logs, so a wrong source shows up before the policy is enforced.
 * Reports are untrusted input: capped in size and logged as plain data.
 */
export const POST: RequestHandler = async ({ request }) => {
	const text = (await request.text()).slice(0, 4000);
	console.warn('[csp-report]', text.replace(/\s+/g, ' '));
	return new Response(null, { status: 204 });
};
