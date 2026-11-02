import type { PageLoad } from './$types';

/** Only the order id is taken from the URL; the payment outcome is always read
 *  from the server (payments.sync / payments.getStatus), never from params. */
export const load: PageLoad = ({ params }) => ({ orderId: params.orderId });
