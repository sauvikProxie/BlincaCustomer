import type { Page } from '@playwright/test';

/**
 * Where customer.setup.ts parks the signed-in session. Specs that only need
 * to *be* signed in reuse it with `test.use({ storageState: STORAGE_STATE })`
 * instead of signing in again, which keeps them clear of the rate limit.
 */
export const STORAGE_STATE = 'test-results/.auth/customer.json';

export const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL ?? 'user@blinca.test';
export const CUSTOMER_PASSWORD =
	process.env.E2E_CUSTOMER_PASSWORD ?? process.env.SEED_CUSTOMER_PASSWORD ?? 'customer-dev-pw-1';

let lastAttempt = 0;

/**
 * Better Auth rate-limits sign-in to 3 attempts per 10 s per IP (see
 * packages/backend/convex/auth.ts). The budget is shared by every spec, so
 * this module is the single place attempts are spaced out — which only works
 * because playwright.config.ts pins `workers: 1`.
 */
export async function throttleSignIn(page: Page) {
	const wait = 11_000 - (Date.now() - lastAttempt);
	if (wait > 0) await page.waitForTimeout(wait);
	lastAttempt = Date.now();
}

/**
 * Opens /login and waits for hydration. The form only works once the auth
 * client has run, and its session fetch is the signal that it has.
 */
export async function gotoLogin(page: Page, path = '/login') {
	const sessionLoaded = page.waitForResponse((res) => res.url().includes('/api/auth/get-session'));
	await page.goto(path);
	await sessionLoaded;
}

/** Fields use the transplanted login ids (l-email/l-pass/l-name) in either locale. */
export async function signIn(
	page: Page,
	email: string,
	password: string,
	next = '/'
): Promise<void> {
	await throttleSignIn(page);
	await gotoLogin(page, `/login?next=${encodeURIComponent(next)}`);
	await page.locator('#l-email').fill(email);
	await page.locator('#l-pass').fill(password);
	await page.locator('form.auth-form button.btn-primary').click();
}
