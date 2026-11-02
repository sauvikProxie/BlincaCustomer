import { error } from '@sveltejs/kit';

// Rendered per request, not prerendered: the (app) layout loads live site data
// from Convex, which a build has no backend to answer (and a baked copy would
// go stale). Cloudflare caches nothing here beyond the usual headers.
export const prerender = false;

const PAGES = ['about', 'how', 'help', 'contact', 'terms', 'privacy'];

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
	if (!PAGES.includes(params.page)) error(404, 'Not found');
	return { page: params.page };
}
