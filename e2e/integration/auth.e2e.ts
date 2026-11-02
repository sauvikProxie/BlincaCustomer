import { expect, test } from '@playwright/test';
import { CUSTOMER_EMAIL as EMAIL, CUSTOMER_PASSWORD as PASSWORD, signIn } from '../support/signIn';

/**
 * Real-backend auth (Swedish locale by default).
 * Covers: guard redirect, log in, wrong password, sign up, session after
 * reload, logged-in /login redirect, log out + reload stays out.
 */
test('signed-out visitor is redirected to login with next', async ({ page }) => {
	await page.goto('/account');
	await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
});

test('customer logs in and sees their account', async ({ page }) => {
	await signIn(page, EMAIL, PASSWORD, '/account');
	await expect(page).toHaveURL(/\/account/);
	await expect(page.getByRole('heading', { name: 'Konto' })).toBeVisible();
	await expect(page.locator('#app').getByText(EMAIL)).toBeVisible();
});

test('wrong password shows an error', async ({ page }) => {
	await signIn(page, EMAIL, 'fel-losenord-123');
	await expect(page.locator('p.form-err:not([hidden])')).toBeVisible();
});

test('customer can sign up with a fresh address', async ({ page }) => {
	const stamp = Date.now();
	const email = `e2e-${stamp}@blinca.test`;
	// Spacing for Better Auth's per-IP limiter (shared with the sign-in helper).
	await page.waitForTimeout(11000);
	await page.goto('/login?mode=signup');
	await expect(page.locator('#l-name')).toBeVisible();
	// Backend names allow letters/spaces/hyphens/apostrophes only (no digits).
	await page.locator('#l-name').fill('Playwright Tester');
	await page.locator('#l-email').fill(email);
	await page.locator('#l-pass').fill('Testlosen123');
	await page.locator('form.auth-form button.btn-primary').click();
	await expect(page).toHaveURL(/localhost:5173\/(\?.*)?$/, { timeout: 30000 });
	await page.goto('/account');
	await expect(page.locator('#app').getByText(email)).toBeVisible();
});

test('session survives reload; logged-in /login redirects home', async ({ page }) => {
	await signIn(page, EMAIL, PASSWORD, '/account');
	await expect(page).toHaveURL(/\/account/);
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.locator('#app').getByText(EMAIL)).toBeVisible({ timeout: 15000 });
	await page.goto('/login');
	await expect(page).toHaveURL(/localhost:5173\/(\?.*)?$/);
});

test('logout returns to login and stays out after reload', async ({ page }) => {
	await signIn(page, EMAIL, PASSWORD, '/account');
	await expect(page).toHaveURL(/\/account/);
	await page.locator('.side-nav button.danger').click();
	await expect(page).toHaveURL(/localhost:5173\/(\?.*)?$/); // logout lands on the public home page
	await expect(page.locator('.pill')).toHaveCount(0);
	await page.goto('/account');
	await expect(page).toHaveURL(/\/login/);
});
