import { absolute } from '#lib/site.js';
import { publicRoutes, type SitemapEntry } from '#lib/seo/routes.js';
import { loadRestaurants } from '#lib/services/catalog.js';
import type { RequestHandler } from './$types';

// Dynamic (not prerendered): restaurant slugs come from Convex at request
// time, so a redeploy is never needed for a new restaurant to appear. The
// edge caches the response for an hour.
export const prerender = false;

/** Sitemap files may hold 50,000 URLs; the public list query is capped well below that. */
const MAX_RESTAURANTS = 500;

function urlEntry(entry: SitemapEntry): string {
	return [
		'\t<url>',
		`\t\t<loc>${absolute(entry.path)}</loc>`,
		...(entry.lastmod ? [`\t\t<lastmod>${entry.lastmod}</lastmod>`] : []),
		`\t\t<changefreq>${entry.changefreq}</changefreq>`,
		`\t\t<priority>${entry.priority.toFixed(1)}</priority>`,
		'\t</url>'
	].join('\n');
}

/**
 * Built from lib/seo/routes.ts plus every active restaurant. Noindex routes
 * are never in that list, so they cannot leak in here. The restaurant fetch
 * may fail (no backend at build time, a deploy hiccup) — the sitemap then
 * falls back to the static routes rather than 500ing.
 */
export const GET: RequestHandler = async () => {
	const entries: SitemapEntry[] = [...publicRoutes];

	try {
		const { restaurants } = await loadRestaurants({ limit: MAX_RESTAURANTS });
		for (const r of restaurants) {
			entries.push({
				path: `/restaurants/${r.slug}`,
				changefreq: 'daily',
				priority: 0.7
			});
		}
	} catch {
		// Fall through with the static routes only.
	}

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...entries.map(urlEntry),
		'</urlset>',
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=0, s-maxage=3600'
		}
	});
};
