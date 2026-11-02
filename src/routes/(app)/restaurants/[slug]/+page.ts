import { ensureMenu, ensureRestaurant } from '#lib/stores/catalog.svelte.js';
// Transplant: the source restaurant page reads data.slug and pulls the
// restaurant/menu from the catalog engine (DATA in design-check, Convex in real
// mode via the root subscription layer). `data.seo` comes from +page.server.ts.
/** @type {import('./$types').PageLoad} */
export async function load({ params, data, parent }) {
	// Layout and page loads run in parallel: wait until the layout has put the
	// catalog in place, or ensureMenu finds no restaurant and the page keeps the
	// one-category card menu instead of the full one.
	await parent();
	// Not in the (capped) home list? Look it up by slug before the menu.
	await ensureRestaurant(params.slug);
	await ensureMenu(params.slug);
	return { slug: params.slug, seo: data.seo };
}
