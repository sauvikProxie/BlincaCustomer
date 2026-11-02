import { expect, test } from '@playwright/test';

// Logged out: browsing is public, ordering and account pages are not.
test.use({ storageState: { cookies: [], origins: [] } });

test('home is reachable logged out and does not redirect to login', async ({ page }) => {
	const res = await page.goto('/');
	expect(res?.status()).toBe(200);
	await expect(page).not.toHaveURL(/\/login/);
});

test('an unknown restaurant slug is a 404, not a login redirect', async ({ page }) => {
	await page.goto('/restaurants/does-not-exist-verifier');
	await expect(page).not.toHaveURL(/\/login/);
});

for (const path of ['/checkout', '/account', '/orders']) {
	test(`${path} redirects to login and keeps ?next=`, async ({ page }) => {
		await page.goto(path);
		await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
	});
}

test('?next= is not an open redirect', async ({ page }) => {
	await page.goto('/login?next=//evil.test');
	await expect(page).toHaveURL(/localhost|127\.0\.0\.1/);
});
