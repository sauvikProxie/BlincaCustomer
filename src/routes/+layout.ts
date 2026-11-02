/**
 * One canonical shape for every URL: no trailing slash. SvelteKit redirects
 * `/om-oss/` to `/om-oss`, which keeps the canonical tags, the sitemap and
 * what crawlers actually fetch in agreement.
 */
export const trailingSlash = 'never';
