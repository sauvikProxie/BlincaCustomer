import type { PageLoad } from './$types';

/** The order id flows straight to orders.getMine; bad ids fail closed. */
export const load: PageLoad = ({ params }) => ({ orderId: params.orderId });
