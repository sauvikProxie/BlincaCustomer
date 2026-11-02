import { absolute } from '#lib/site.js';
import { noindexRoutes, privatePrefixes } from '#lib/seo/routes.js';
import type { RequestHandler } from './$types';

export const prerender = true;

/**
 * Served as a route rather than a static file so the sitemap URL follows
 * PUBLIC_SITE_URL, and so the disallow list stays in sync with
 * lib/seo/routes.ts instead of being maintained twice.
 */
export const GET: RequestHandler = async () => {
	const body = [
		'User-agent: *',
		'Allow: /',
		...noindexRoutes.map((path) => `Disallow: ${path}`),
		...privatePrefixes.map((prefix) => `Disallow: ${prefix}`),
		'',
		`Sitemap: ${absolute('/sitemap.xml')}`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=0, s-maxage=3600'
		}
	});
};
