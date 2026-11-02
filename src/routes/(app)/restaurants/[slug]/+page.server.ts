import { loadRestaurant } from '#lib/services/catalog.js';
import type { PageServerLoad } from './$types';

/**
 * Public detail for the structured data only (address, phone, hours): the
 * visible page reads the client catalog, which does not carry these on the
 * server render. Failure is not fatal; the page just ships thinner JSON-LD.
 */
export const load: PageServerLoad = async ({ params }) => {
	try {
		const d = await loadRestaurant(params.slug);
		if (!d) return { seo: null };
		return {
			seo: {
				address: d.address,
				city: d.city,
				postalCode: d.postalCode,
				phone: d.phone,
				imageUrl: d.imageUrl,
				weekly: d.hours.weekly,
				specialDays: d.hours.specialDays
			}
		};
	} catch {
		return { seo: null };
	}
};
