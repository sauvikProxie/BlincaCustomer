// Transplant: the source tracking page is client-only (live state) and reads
// data.id. Map the customer route param [orderId] -> id.
export const ssr = false;

/** @type {import('./$types').PageLoad} */
export function load({ params }) {
	return { id: params.orderId };
}
