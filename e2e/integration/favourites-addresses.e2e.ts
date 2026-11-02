import { expect, test } from '@playwright/test';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, STORAGE_STATE, signIn } from '../support/signIn';

test.use({ storageState: STORAGE_STATE });

test('favourite persists across reload (server-backed)', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	const fav = page.getByRole('button', { name: 'Favorit Blinca Demo' });
	await expect(fav).toBeVisible();
	const pressed = await fav.getAttribute('aria-pressed');
	await fav.click();
	await page.waitForTimeout(1500);
	expect(await fav.getAttribute('aria-pressed')).not.toBe(pressed);
	// Restore the original state so the seed stays clean for other specs.
	await fav.click();
	await page.goto('/account?tab=favourites');
	await page.waitForLoadState('networkidle');
	const before = await page.locator('.list-row').count();
	await page.reload();
	await page.waitForLoadState('networkidle');
	expect(await page.locator('.list-row').count()).toBe(before);
});

test('favourite persists across logout + login (server-backed)', async ({ page }) => {
	// Make blinca-demo a favourite, whatever its starting state.
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	const fav = page.getByRole('button', { name: 'Favorit Blinca Demo' });
	await expect(fav).toBeVisible();
	if ((await fav.getAttribute('aria-pressed')) !== 'true') {
		await fav.click();
		await expect(fav).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });
	}

	// Log out from the account page.
	await page.goto('/account');
	await page.locator('.side-nav button.danger').click();
	await expect(page).toHaveURL(/localhost:5173\/(\?.*)?$/); // logout lands on the public home page

	// Sign back in and land on the restaurant. Favourites live in Convex
	// (favorites.listMyFavorites / toggleFavorite), so the new session sees it.
	await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, '/restaurants/blinca-demo');
	await page.waitForURL(/\/restaurants\/blinca-demo/, { timeout: 30000 });
	await page.waitForLoadState('networkidle');
	const favAgain = page.getByRole('button', { name: 'Favorit Blinca Demo' });
	await expect(favAgain).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });

	// Restore the seed (un-favourite) so later specs/runs start clean.
	await favAgain.click();
	await expect(favAgain).toHaveAttribute('aria-pressed', 'false', { timeout: 15000 });
});

test('addresses come from the backend seed', async ({ page }) => {
	// The spec above logs out, which revokes the saved session: sign in again for this one.
	await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, '/account?tab=addresses');
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.addr-row', { hasText: 'Hem' }).first()).toBeVisible();
});
