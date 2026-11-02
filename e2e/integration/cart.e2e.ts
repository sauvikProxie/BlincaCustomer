import { expect, test } from '@playwright/test';
import { STORAGE_STATE, signIn, CUSTOMER_EMAIL, CUSTOMER_PASSWORD } from '../support/signIn';
import { badgeCount, clearCart } from '../support/cart';

test.use({ storageState: STORAGE_STATE });

test('cart starts empty for the flow', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await clearCart(page);
	expect(await badgeCount(page)).toBe(0);
});

test('adding an item syncs and survives reload', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await clearCart(page);
	await page.locator('article.card', { hasText: 'Mineralvatten' }).locator('.add-round').click();
	await expect.poll(() => badgeCount(page), { timeout: 20000 }).toBe(1);
	await page.reload();
	await page.waitForLoadState('networkidle');
	expect(await badgeCount(page)).toBe(1);
	await clearCart(page);
	expect(await badgeCount(page)).toBe(0);
});

test('cart survives logout + login (server-side cart)', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await clearCart(page);
	await page.locator('article.card', { hasText: 'Mineralvatten' }).locator('.add-round').click();
	await expect.poll(() => badgeCount(page), { timeout: 20000 }).toBe(1);
	await page.goto('/account');
	await page.locator('.side-nav button.danger').click();
	await expect(page).toHaveURL(/localhost:5173\/(\?.*)?$/); // logout lands on the public home page
	await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, '/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	expect(await badgeCount(page)).toBe(1);
	await clearCart(page);
});
