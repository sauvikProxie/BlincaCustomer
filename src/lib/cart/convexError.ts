/** The `code` of a ConvexError thrown by a backend function, or null. */
export function convexErrorCode(error: unknown): string | null {
	const code = (error as { data?: { code?: unknown } } | null)?.data?.code;
	return typeof code === 'string' ? code : null;
}
