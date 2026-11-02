import { site, absolute } from '#lib/site.js';

// Built from char codes so the literals survive any tooling that rewrites
// escape sequences in source.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const BACKSLASH_U = String.fromCharCode(0x5c) + 'u';

/**
 * JSON-LD builders. Each returns one entity, rendered as its own
 * <script type="application/ld+json"> server-side.
 *
 * Nothing optional is emitted unless src/lib/site.ts actually holds a value,
 * so the graph never contains a fabricated address, phone or profile.
 */

export type JsonLdNode = Record<string, unknown>;

/**
 * `</script>` inside a JSON string would close the tag early. Escaping `<`
 * (and the line separators JSON leaves raw) makes the payload safe to inline.
 */
export function serializeJsonLd(node: JsonLdNode): string {
	return JSON.stringify(node)
		.split('<')
		.join(BACKSLASH_U + '003c')
		.split(LINE_SEPARATOR)
		.join(BACKSLASH_U + '2028')
		.split(PARAGRAPH_SEPARATOR)
		.join(BACKSLASH_U + '2029');
}

/**
 * Pass `description` from Paraglide so it follows the active locale; the
 * `site.description` default is Swedish only.
 *
 * Organization, not LocalBusiness: Blinca has no walk-in premises, so there is
 * no real PostalAddress or GeoCoordinates to publish. `areaServed` carries the
 * geography instead.
 */
export function organization(description: string = site.description): JsonLdNode {
	const node: JsonLdNode = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': `${site.url}/#organization`,
		name: site.name,
		url: site.url,
		description,
		logo: {
			'@type': 'ImageObject',
			url: absolute(site.logo.path),
			width: site.logo.width,
			height: site.logo.height
		},
		areaServed: {
			'@type': 'Country',
			name: 'Sweden',
			identifier: site.areaServed
		}
	};

	if (site.legalName) node.legalName = site.legalName;
	if (site.sameAs?.length) node.sameAs = site.sameAs;
	if (site.address) {
		node.address = { '@type': 'PostalAddress', ...site.address };
	}

	// A contactPoint with neither an email nor a phone is meaningless.
	if (site.email || site.phone) {
		const contactPoint: JsonLdNode = {
			'@type': 'ContactPoint',
			contactType: 'customer support',
			availableLanguage: ['sv', 'en']
		};
		if (site.email) contactPoint.email = site.email;
		if (site.phone) contactPoint.telephone = site.phone.href;
		node.contactPoint = contactPoint;
	}

	return node;
}

/**
 * WebSite. `potentialAction`/SearchAction is deliberately omitted: there is no
 * public search endpoint yet (/restauranger does not exist), and pointing a
 * SearchAction at a URL that 404s is a structured-data error.
 */
export function website(description: string = site.description): JsonLdNode {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': `${site.url}/#website`,
		name: site.name,
		url: site.url,
		description,
		inLanguage: site.locale,
		publisher: { '@id': `${site.url}/#organization` }
	};
}

export type Crumb = { name: string; path: string };

/** Mirrors the visible breadcrumb trail exactly. */
export function breadcrumbList(crumbs: Crumb[]): JsonLdNode {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.name,
			item: absolute(crumb.path)
		}))
	};
}

/** A content page, tied back to the site and organization. */
export function webPage(options: { title: string; description: string; path: string }): JsonLdNode {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		'@id': `${absolute(options.path)}#webpage`,
		url: absolute(options.path),
		name: options.title,
		description: options.description,
		inLanguage: site.locale,
		isPartOf: { '@id': `${site.url}/#website` },
		about: { '@id': `${site.url}/#organization` }
	};
}

const SCHEMA_WEEKDAYS = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday'
] as const;

function minutesToClock(minutes: number): string {
	const h = Math.floor(minutes / 60) % 24;
	const m = minutes % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Schema.org writes "open until midnight" as 23:59, never 24:00 or 00:00. */
const closeClock = (minutes: number) => (minutes >= 1440 ? '23:59' : minutesToClock(minutes));

export type RestaurantJsonLdInput = {
	name: string;
	path: string;
	description?: string;
	imageUrl?: string;
	servesCuisine?: string[];
	telephone?: string;
	address?: {
		streetAddress?: string;
		addressLocality?: string;
		postalCode?: string;
	};
	weeklyHours: { dayOfWeek: number; openMinutes: number; closeMinutes: number }[];
	specialDays: { date: string; ranges: { openMinutes: number; closeMinutes: number }[] }[];
};

/**
 * schema.org Restaurant built ONLY from fields the public query returns.
 * No rating, priceRange or geo: the schema has none of those for us, so they
 * are omitted rather than invented. Midnight-crossing ranges are emitted as
 * closing "00:00"-style times on the same weekday (schema has no
 * cross-midnight form); special days ride along as validFrom/validThrough.
 */
export function restaurant(input: RestaurantJsonLdInput): JsonLdNode {
	const node: JsonLdNode = {
		'@context': 'https://schema.org',
		'@type': 'Restaurant',
		'@id': `${absolute(input.path)}#restaurant`,
		url: absolute(input.path),
		name: input.name,
		inLanguage: [site.locale, 'en-SE']
	};

	if (input.description) node.description = input.description;
	if (input.imageUrl) node.image = input.imageUrl;
	if (input.servesCuisine?.length) node.servesCuisine = input.servesCuisine;
	if (input.telephone) node.telephone = input.telephone;
	if (input.address) {
		const { streetAddress, addressLocality, postalCode } = input.address;
		if (streetAddress || addressLocality || postalCode) {
			node.address = {
				'@type': 'PostalAddress',
				addressCountry: 'SE',
				...(streetAddress ? { streetAddress } : {}),
				...(addressLocality ? { addressLocality } : {}),
				...(postalCode ? { postalCode } : {})
			};
		}
	}

	const specs: JsonLdNode[] = input.weeklyHours.map((range) => ({
		'@type': 'OpeningHoursSpecification',
		dayOfWeek: SCHEMA_WEEKDAYS[range.dayOfWeek] ?? SCHEMA_WEEKDAYS[0],
		opens: minutesToClock(range.openMinutes),
		closes: closeClock(range.closeMinutes)
	}));
	for (const day of input.specialDays) {
		for (const range of day.ranges) {
			specs.push({
				'@type': 'OpeningHoursSpecification',
				validFrom: day.date,
				validThrough: day.date,
				opens: minutesToClock(range.openMinutes),
				closes: closeClock(range.closeMinutes)
			});
		}
	}
	if (specs.length > 0) node.openingHoursSpecification = specs;

	return node;
}
