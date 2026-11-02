/**
 * The public, indexable routes. The sitemap, llms.txt and the SEO tests all
 * read this one list.
 *
 * `lastmod` is the date the page's content last changed — update it when you
 * edit a page, not on every deploy. Restaurant URLs come from Convex at
 * request time: `/sitemap.xml` concatenates them with this list.
 */
export type SitemapEntry = {
	path: string;
	lastmod?: string;
	changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
	priority: number;
};

/** Pages with a canonical URL of their own. Never list a redirect here. */
export const INFO_PAGES = ['how', 'about', 'help', 'contact', 'terms', 'privacy'] as const;

export const publicRoutes: readonly SitemapEntry[] = [
	{ path: '/', changefreq: 'daily', priority: 1 },
	...INFO_PAGES.map((page) => ({
		path: `/info/${page}`,
		lastmod: '2026-10-05',
		changefreq: 'monthly' as const,
		priority: page === 'how' ? 0.8 : 0.6
	}))
];

/**
 * Routes that exist but must never be indexed or listed. Kept next to the
 * sitemap so the two can never drift apart — robots.txt disallows these and
 * the pages themselves send robots: noindex,nofollow.
 */
export const noindexRoutes: readonly string[] = [
	'/login',
	'/signup',
	'/forgot-password',
	'/reset-password'
];

/**
 * Everything behind authentication; blanket-disallowed by prefix. `/search` is
 * deliberately absent: the page sends noindex, which crawlers only see if they
 * may fetch it.
 */
export const privatePrefixes: readonly string[] = [
	'/api/',
	'/dashboard',
	'/account',
	'/checkout',
	'/cart',
	'/orders',
	'/favorites',
	'/restaurant/',
	'/dev/'
];
