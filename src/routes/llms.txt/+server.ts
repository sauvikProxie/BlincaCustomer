import { site, absolute } from '#lib/site.js';
import { publicRoutes } from '#lib/seo/routes.js';
import type { RequestHandler } from './$types';

export const prerender = true;

/**
 * Plain-text summary for language models (llmstxt.org). Everything here is
 * true of the service as built; nothing claims coverage, counts or timings.
 */
const PAGE_NOTES: Record<string, string> = {
	'/': 'Home: browse restaurants and order food.',
	'/info/how': 'How it works: choosing a restaurant, placing an order, following the delivery.',
	'/info/about': 'About Blinca: what the service does and how it treats restaurants.',
	'/info/help': 'Help and answers to common questions.',
	'/info/contact': 'Contact page.',
	'/info/terms': 'Terms for customers.',
	'/info/privacy': 'How personal data is handled.'
};

export const GET: RequestHandler = async () => {
	const lines = [
		`# ${site.name}`,
		'',
		`> ${site.description}`,
		'',
		'Blinca is a food-delivery marketplace for the Swedish market. Customers',
		'order from restaurants and follow the delivery; restaurants manage their',
		'own menus and orders in a separate partner application.',
		'',
		'The interface is Swedish by default with English available. Prices are',
		'shown in Swedish kronor and include VAT. One customer account works',
		'across every restaurant on the platform.',
		'',
		'## Pages',
		''
	];

	for (const route of publicRoutes) {
		const note = PAGE_NOTES[route.path];
		lines.push(`- [${absolute(route.path)}](${absolute(route.path)})${note ? `: ${note}` : ''}`);
	}

	lines.push(
		'',
		'## Notes',
		'',
		'- Account pages (/login, /signup) are excluded from indexing.',
		'- Restaurant pages live at /restaurants/<slug> and are listed in /sitemap.xml.',
		'- Checkout, account and order pages require sign-in and are not indexed.',
		''
	);

	return new Response(lines.join('\n'), {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=0, s-maxage=3600'
		}
	});
};
