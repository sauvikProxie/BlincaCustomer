// The one place the storefront names the status unions. They are inferred from
// the Step 1 Convex queries (via the service), so there is no second copy to
// drift from and no need to touch @blinca/backend's package exports.
export type { ItemAvailability, RestaurantStatus } from '#lib/services/catalog.js';

import type { RestaurantDetailData } from '#lib/services/catalog.js';

/** The timing payload the restaurant page hands to the client status helper. */
export type RestaurantStatusInput = Pick<
	RestaurantDetailData,
	'status' | 'serverNow' | 'opensAt' | 'closesAt' | 'nextChangeAt' | 'pausedUntil' | 'hours'
>;
