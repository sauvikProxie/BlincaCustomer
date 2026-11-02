import { convexErrorCode } from '#lib/cart/convexError.js';

// Mirrors issueCategoryValidator / MAX_ISSUE_MESSAGE in packages/backend/convex/lib/issueRules.ts.
export const ISSUE_CATEGORIES = [
	'missing_item',
	'late',
	'wrong_order',
	'quality',
	'other'
] as const;
export const MAX_ISSUE_MESSAGE = 500;

/** Backend caps reports per order (RATE_LIMITED); that is the "already reported" signal. */
export function issueFailure(error: unknown): 'already' | 'error' {
	return convexErrorCode(error) === 'RATE_LIMITED' ? 'already' : 'error';
}

export const issueMessageValid = (text: string): boolean =>
	text.trim().length > 0 && text.trim().length <= MAX_ISSUE_MESSAGE;
