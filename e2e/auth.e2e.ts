import { expect, test } from '@playwright/test';
import {
	CUSTOMER_EMAIL as EMAIL,
	CUSTOMER_PASSWORD as PASSWORD,
	gotoLogin,
	signIn,
	throttleSignIn
} from './support/signIn';

const PARTNER_BASE_URL = process.env.PARTNER_BASE_URL ?? 'http://localhost:5174';

test('customer signs in and sees their account', async ({ page }) => {
	await signIn(page, EMAIL, PASSWORD, '/account');

	await expect(page).toHaveURL(/\/account/);
	await expect(page.getByRole('heading', { name: /^(Konto|Account)$/ })).toBeVisible();
	await expect(page.locator('#app').getByText(EMAIL)).toBeVisible();

	// Signed in, /login sends the customer on to the home (safeNext default).
	await page.goto('/login');
	await expect(page).toHaveURL(/^https?:\/\/[^/]+\/(\?.*)?$/);
});

test('signed-out visitor is redirected to login', async ({ page }) => {
	await page.goto('/account');
	await expect(page).toHaveURL(/\/login/);
});

test('wrong password shows an alert', async ({ page }) => {
	await signIn(page, EMAIL, 'not-the-password');
	await expect(page.locator('.form-err')).toBeVisible();
});

test('logout sends the customer to the home page and ends the session', async ({ page }) => {
	await signIn(page, EMAIL, PASSWORD, '/account');
	await expect(page).toHaveURL(/\/account/);

	await page.getByRole('button', { name: /Log out|Logga ut/ }).click();
	await expect(page).toHaveURL(/^https?:\/\/[^/]+\/(\?.*)?$/);

	// Session is gone: the account page bounces to login again.
	await page.goto('/account');
	await expect(page).toHaveURL(/\/login/);
});

test('a customer cannot open partner routes', async ({ page }) => {
	await signIn(page, EMAIL, PASSWORD, '/account');
	await expect(page).toHaveURL(/\/account/);

	// Cookies are scoped by host, not port, so on localhost the customer
	// session cookie is also sent to the partner app. It is rejected there
	// because the account type is customer, and the visitor bounces to login.
	await page.goto(`${PARTNER_BASE_URL}/orders`);
	await expect(page).toHaveURL(/\/login/);
});

test('a partner account gets the generic invalid-credentials error, no session cookie, no hints', async ({
	page,
	baseURL
}) => {
	// Cross-type sign-in straight through the auth proxy.
	const credentials = {
		email: process.env.E2E_PARTNER_EMAIL ?? 'owner@blinca.test',
		password:
			process.env.E2E_PARTNER_PASSWORD ?? process.env.SEED_PARTNER_PASSWORD ?? 'partner-dev-pw-1'
	};
	await throttleSignIn(page); // the API call spends sign-in rate-limit budget too
	const res = await page.request.post('/api/auth/sign-in/email', {
		headers: { origin: baseURL! },
		data: credentials
	});
	expect(res.status()).toBe(401);
	expect(await res.json()).toEqual({
		code: 'INVALID_EMAIL_OR_PASSWORD',
		message: 'Invalid email or password'
	});
	expect(res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie')).toHaveLength(0);
	expect(await page.context().cookies()).toHaveLength(0);

	// The form shows the same error as a wrong password and nothing else.
	await throttleSignIn(page);
	await gotoLogin(page);
	await page.locator('#l-email').fill(credentials.email);
	await page.locator('#l-pass').fill(credentials.password);
	await page.locator('form.auth-form button.btn-primary').click();
	await expect(page.locator('.form-err')).toBeVisible();
	await expect(page.locator('.form-err')).toHaveText(/Invalid email or password|Fel e-postadress/);
	await expect(page).toHaveURL(/\/login/);
	expect(await page.locator('.auth-card').innerText()).not.toMatch(
		/partner|restaurant|restaurang|customer account|account type|kontotyp|\bapp\b|appen/i
	);

	await page.goto('/account');
	await expect(page).toHaveURL(/\/login\?next=/);
	await expect(page.locator('.form-err')).toBeHidden();
});
