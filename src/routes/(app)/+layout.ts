// Transplant: mirror the source +layout.js — load the site catalog and hand it
// to the catalog engine before pages render. In design-check / mock this is the
// source DATA; in real mode api.loadSiteData() maps Convex into the same shape.
import { loadSiteData } from '#lib/api.js';
import { setSiteData } from '#lib/stores/catalog.svelte.js';

/** @type {import('./$types').LayoutLoad} */
export async function load() {
	setSiteData(await loadSiteData());
	return {};
}
