import { PUBLIC_SITE_URL } from '$app/env/public';

/**
 * Single source of truth for everything identity-shaped: canonicals, Open
 * Graph, JSON-LD, the sitemap, robots.txt and llms.txt all read from here.
 *
 * Fields that would need a real-world value we do not have yet are typed as
 * optional and left `undefined`. Every consumer omits them rather than
 * emitting a placeholder — nothing here is ever invented.
 */

export type SiteConfig = {
	name: string;
	/** Registered company name, if different from the display name. */
	legalName?: string;
	url: string;
	description: string;
	locale: string;
	/** BCP-47 turned into the underscore form Open Graph wants. */
	ogLocale: string;
	logo: { path: string; width: number; height: number };
	ogImage: { path: string; width: number; height: number; alt: string };
	email?: string;
	phone?: { display: string; href: string };
	/** schema.org sameAs — social profiles. */
	sameAs?: string[];
	/** Only ever set from a real registered address. */
	address?: {
		streetAddress: string;
		postalCode: string;
		addressLocality: string;
		addressCountry: string;
	};
	areaServed: string;
};

/** Trailing slashes are stripped so canonicals never produce two URLs. */
const origin = PUBLIC_SITE_URL.replace(/\/+$/, '');

export const site: SiteConfig = {
	name: 'Blinca',
	url: origin,
	description:
		'Blinca är en matleveranstjänst för den svenska marknaden. Hitta en restaurang, lägg din beställning och följ leveransen hela vägen hem.',
	locale: 'sv-SE',
	ogLocale: 'sv_SE',
	logo: { path: '/icon-512.png', width: 512, height: 512 },
	ogImage: {
		path: '/og-default.png',
		width: 1200,
		height: 630,
		alt: 'Blinca – mat hem till dörren'
	},
	areaServed: 'SE'

	// Deliberately absent until supplied; see README "SEO values still needed".
	// legalName, email, phone, sameAs, address
};

/** Absolute URL for a path. Input is always a root-relative path. */
export function absolute(path: string): string {
	// Convex image URLs (and any future remote asset) arrive absolute; only
	// root-relative paths get the site origin prefixed.
	if (/^https?:\/\//.test(path)) return path;
	return `${site.url}${path.startsWith('/') ? path : `/${path}`}`.replace(/\/$/, '') || site.url;
}

/**
 * True only when served from the production canonical origin. Pages that are
 * indexable in production pass `noindex: !isProduction()` to Seo, so dev,
 * preview and staging never leak into the index without per-environment
 * flags or invented values.
 */
export function isProduction(): boolean {
	return origin === 'https://blinca.se';
}
