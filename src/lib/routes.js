/* Path-based route checks. page.route.id carries the route groups
   ('/(app)/(protected)/checkout'), so compare pathnames instead. */

/** @param {string} path */
export const isHomePath = (path) => path === '/';
/** @param {string} path */
export const isRestaurantPath = (path) => path.startsWith('/restaurants/');
/** @param {string} path */
export const isCheckoutPath = (path) => path === '/checkout';
/** Live tracking page, not the pay pages under it. @param {string} path */
export const isTrackPath = (path) => /^\/orders\/[^/]+$/.test(path);
