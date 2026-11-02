/**
 * Hosts that must never be indexed: staging environments (`staging.`,
 * `*-staging.`), the Workers default domain, and local development. The real
 * site is the only host search engines should see.
 */
export function isNonProductionHost(hostname: string): boolean {
	return (
		/(^|[.-])staging([.-]|$)/.test(hostname) ||
		hostname.endsWith('.workers.dev') ||
		hostname === 'localhost' ||
		hostname === '127.0.0.1'
	);
}
