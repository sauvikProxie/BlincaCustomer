import { expect, test, type Page } from '@playwright/test';

/**
 * Technical-SEO contract for the public pages. No sign-in needed: everything
 * asserted here must be present in the server-rendered HTML.
 */

const PUBLIC_PAGES = [
	{ path: '/', name: 'home' },
	{ path: '/info/how', name: 'how' },
	{ path: '/info/about', name: 'about' },
	{ path: '/info/help', name: 'help' },
	{ path: '/info/contact', name: 'contact' },
	{ path: '/info/terms', name: 'terms' },
	{ path: '/info/privacy', name: 'privacy' }
] as const;

/** Old URLs that 308 to a /info page: must never be listed or used as canonicals. */
const REDIRECT_PATHS = ['/sa-fungerar-det', '/om-oss', '/kontakt', '/privacy', '/terms'] as const;

const NOINDEX_PAGES = ['/login', '/signup', '/reset-password', '/search'] as const;

const head = (page: Page, selector: string, attr = 'content') =>
	page.locator(selector).first().getAttribute(attr);

async function jsonLdNodes(page: Page): Promise<Record<string, unknown>[]> {
	const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
	return raw.map((text) => JSON.parse(text) as Record<string, unknown>);
}

test.describe('public pages', () => {
	for (const { path, name } of PUBLIC_PAGES) {
		test(`${name} has a complete, valid head`, async ({ page }) => {
			await page.goto(path);

			// Title: unique shape, never a framework default, within budget.
			const title = await page.title();
			expect(title.length).toBeGreaterThan(10);
			expect(title.length).toBeLessThanOrEqual(60);
			expect(title).toMatch(/Blinca/);
			expect(title).not.toMatch(/Svelte|Vite|SvelteKit/i);

			// Description within the usual snippet budget.
			const description = await head(page, 'meta[name="description"]');
			expect(description).toBeTruthy();
			expect(description!.length).toBeGreaterThanOrEqual(110);
			expect(description!.length).toBeLessThanOrEqual(165);

			// Canonical: absolute, no trailing slash (except the root), no query.
			const canonical = await head(page, 'link[rel="canonical"]', 'href');
			expect(canonical).toBe(`https://blinca.se${path === '/' ? '' : path}`);
			expect(canonical).not.toMatch(/\?|#/);

			await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index,follow/);

			// Open Graph + Twitter.
			expect(await head(page, 'meta[property="og:title"]')).toBe(title);
			expect(await head(page, 'meta[property="og:description"]')).toBe(description);
			expect(await head(page, 'meta[property="og:url"]')).toBe(canonical);
			expect(await head(page, 'meta[property="og:locale"]')).toBe('sv_SE');
			expect(await head(page, 'meta[property="og:type"]')).toBe('website');
			expect(await head(page, 'meta[property="og:image"]')).toBe(
				'https://blinca.se/og-default.png'
			);
			expect(await head(page, 'meta[property="og:image:width"]')).toBe('1200');
			expect(await head(page, 'meta[property="og:image:height"]')).toBe('630');
			expect(await head(page, 'meta[property="og:image:alt"]')).toBeTruthy();
			expect(await head(page, 'meta[name="twitter:card"]')).toBe('summary_large_image');

			// No hreflang while the locale is cookie-based (every alternate would be this URL);
			// restore the check together with the alternates once locales have their own URLs.
			await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
			// Global icon/manifest/theme-color links.
			expect(await head(page, 'link[rel="manifest"]', 'href')).toMatch(/\/site\.webmanifest$/);
			expect(await head(page, 'link[rel="apple-touch-icon"]', 'href')).toMatch(
				/\/apple-touch-icon\.png$/
			);
			expect(await head(page, 'link[rel="icon"]', 'href')).toBeTruthy();
			await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
			await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		});

		test(`${name} emits parseable JSON-LD`, async ({ page }) => {
			await page.goto(path);
			const nodes = await jsonLdNodes(page);
			expect(nodes.length).toBeGreaterThan(0);

			for (const node of nodes) {
				expect(node['@context']).toBe('https://schema.org');
				expect(typeof node['@type']).toBe('string');
			}

			const types = nodes.map((n) => n['@type']);
			expect(types).toContain('WebPage');
			const web = nodes.find((n) => n['@type'] === 'WebPage')!;
			expect(web.url).toBe(`https://blinca.se${path === '/' ? '' : path}`);

			if (path === '/') {
				expect(types).toContain('Organization');
				expect(types).toContain('WebSite');

				const org = nodes.find((n) => n['@type'] === 'Organization')!;
				expect(org.name).toBe('Blinca');
				expect(org.url).toBe('https://blinca.se');
				expect(org.areaServed).toMatchObject({ '@type': 'Country', name: 'Sweden' });
				// Nothing fabricated: no address until a real one is supplied.
				expect(org.address).toBeUndefined();

				// No SearchAction while no public search URL exists.
				const site = nodes.find((n) => n['@type'] === 'WebSite')!;
				expect(site.potentialAction).toBeUndefined();
			}

			// Ratings, reviews and offers must not appear without real data.
			const serialized = JSON.stringify(nodes);
			expect(serialized).not.toMatch(/AggregateRating|"Review"|"Offer"/);
		});
	}

	test('every public page has a distinct title, description and canonical', async ({ page }) => {
		const seen = {
			titles: new Set<string>(),
			descriptions: new Set<string>(),
			urls: new Set<string>()
		};
		for (const { path } of PUBLIC_PAGES) {
			await page.goto(path);
			seen.titles.add(await page.title());
			seen.descriptions.add((await head(page, 'meta[name="description"]')) ?? '');
			seen.urls.add((await head(page, 'link[rel="canonical"]', 'href')) ?? '');
		}
		expect(seen.titles.size).toBe(PUBLIC_PAGES.length);
		expect(seen.descriptions.size).toBe(PUBLIC_PAGES.length);
		expect(seen.urls.size).toBe(PUBLIC_PAGES.length);
	});
});

test.describe('restaurant pages', () => {
	test('a public restaurant has a canonical, OG tags and Restaurant JSON-LD', async ({
		page,
		request
	}) => {
		const sitemap = await (await request.get('/sitemap.xml')).text();
		const slug = sitemap.match(/<loc>https:\/\/blinca\.se\/restaurants\/([^<]+)<\/loc>/)?.[1];
		test.skip(!slug, 'No restaurant in the sitemap (empty seed).');
		const path = `/restaurants/${slug}`;
		await page.goto(path);

		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index,follow/);
		expect(await head(page, 'link[rel="canonical"]', 'href')).toBe(`https://blinca.se${path}`);
		expect(await head(page, 'meta[property="og:type"]')).toBe('restaurant.restaurant');
		expect(await head(page, 'meta[property="og:url"]')).toBe(`https://blinca.se${path}`);
		expect((await head(page, 'meta[name="description"]'))!.length).toBeGreaterThan(60);
		expect(await page.title()).toMatch(/ – Blinca$/);

		const nodes = await jsonLdNodes(page);
		const rest = nodes.find((n) => n['@type'] === 'Restaurant');
		expect(rest, 'Restaurant JSON-LD').toBeTruthy();
		expect(rest!.url).toBe(`https://blinca.se${path}`);
		expect(rest!.name).toBeTruthy();
		expect(JSON.stringify(nodes)).not.toMatch(/AggregateRating|"Review"|"Offer"/);
	});

	test('an unknown restaurant is noindex', async ({ page }) => {
		await page.goto('/restaurants/this-restaurant-does-not-exist');
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex,nofollow'
		);
	});
});

test.describe('non-indexable pages', () => {
	for (const path of NOINDEX_PAGES) {
		test(`${path} is noindex and has a real title`, async ({ page }) => {
			await page.goto(path);
			await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
				'content',
				'noindex,nofollow'
			);
			const title = await page.title();
			expect(title).toMatch(/Blinca/);
			expect(title).not.toMatch(/Svelte|Vite|SvelteKit/i);
		});
	}

	test('the 404 page is noindex, branded and titled', async ({ page }) => {
		const response = await page.goto('/den-har-sidan-finns-inte');
		expect(response?.status()).toBe(404);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex,nofollow'
		);
		expect(await page.title()).toMatch(/Blinca/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	});
});

test.describe('served files', () => {
	test('sitemap.xml lists exactly the public pages', async ({ request }) => {
		const res = await request.get('/sitemap.xml');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toContain('application/xml');

		const body = await res.text();
		for (const { path } of PUBLIC_PAGES) {
			expect(body).toContain(`<loc>https://blinca.se${path === '/' ? '' : path}</loc>`);
		}
		for (const path of NOINDEX_PAGES) {
			expect(body).not.toContain(`https://blinca.se${path}<`);
		}
		for (const path of REDIRECT_PATHS) {
			expect(body).not.toContain(`https://blinca.se${path}<`);
		}
		expect(body).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
	});

	test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
		const res = await request.get('/robots.txt');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toContain('text/plain');

		const body = await res.text();
		expect(body).toContain('User-agent: *');
		expect(body).toContain('Allow: /');
		expect(body).toContain('Disallow: /login');
		expect(body).toContain('Disallow: /signup');
		expect(body).toContain('Disallow: /api/');
		expect(body).toContain('Disallow: /checkout');
		expect(body).not.toContain('Disallow: /info');
		expect(body).toContain('Sitemap: https://blinca.se/sitemap.xml');
	});

	test('llms.txt describes the site truthfully', async ({ request }) => {
		const res = await request.get('/llms.txt');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toContain('text/plain');

		const body = await res.text();
		expect(body).toContain('# Blinca');
		for (const { path } of PUBLIC_PAGES) {
			expect(body).toContain(`https://blinca.se${path === '/' ? '' : path}`);
		}
	});

	test('the icon set and share image are served', async ({ request }) => {
		for (const [path, type] of [
			['/favicon.ico', 'image'],
			['/favicon-32.png', 'image/png'],
			['/apple-touch-icon.png', 'image/png'],
			['/icon-192.png', 'image/png'],
			['/icon-512.png', 'image/png'],
			['/og-default.png', 'image/png'],
			['/site.webmanifest', 'json']
		] as const) {
			const res = await request.get(path);
			expect(res.status(), `${path} should be served`).toBe(200);
			expect(res.headers()['content-type'], `${path} content type`).toContain(type);
		}

		// Share image must stay small enough for crawlers to fetch.
		const og = await request.get('/og-default.png');
		expect((await og.body()).byteLength).toBeLessThan(300 * 1024);
	});
});
