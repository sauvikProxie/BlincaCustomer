import { redirect } from '@sveltejs/kit';
import { loadRestaurants } from '#lib/services/catalog.js';
import type { PageServerLoad } from './$types';

/**
 * Old id-based restaurant links (/restaurant/{id}) now live at the slug route
 * (/restaurants/{slug}). There is no public get-by-id, so resolve the slug from
 * the active list; an unknown or inactive id falls back to the home page.
 * Public (not under the auth guard) so old links don't bounce through login.
 */
export const load: PageServerLoad = async ({ params }) => {
	const { restaurants } = await loadRestaurants({});
	const match = restaurants.find((r) => r._id === params.restaurantId);
	redirect(308, match ? `/restaurants/${match.slug}` : '/');
};
