import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../support/signIn';
import { clearCart } from '../support/cart';

test.use({ storageState: STORAGE_STATE });

/**
 * Mollie handoff: checkout → pay page → Mollie test checkout opens.
 * Return/tracking wiring is asserted on the unpaid order (confirming state +
 * live tracking render with the real order id).
 */
test('pay page hands off to the Mollie test checkout', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await clearCart(page);
	await page.locator('article.card', { hasText: 'Mineralvatten' }).locator('.add-round').click();
	await page.goto('/checkout');
	await page.waitForLoadState('networkidle');
	await page.locator('#co-phone').fill('0701234567');
	const place = page.getByRole('button', { name: /Lägg beställning och betala/ }).last();
	await expect(place).toBeEnabled({ timeout: 15000 });
	await place.click();
	await expect(page).toHaveURL(/\/orders\/.+\/pay/, { timeout: 30000 });
	const total = await page.locator('[data-testid="pay-total"]').textContent();
	expect(total).toMatch(/\d+\s*kr/);
	const payUrl = page.url();
	await page.locator('[data-testid="pay-button"]').click();
	await expect(page).toHaveURL(/mollie\.com/, { timeout: 45000 });
	await page.goto(payUrl.replace(/\/pay$/, '/pay/return'));
	await expect(page.locator('[data-testid="pay-return"]')).toBeVisible();
	await expect(page.locator('[data-testid="pay-confirming"]')).toBeVisible();
});

test('tracking renders the created order with live status', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await clearCart(page);
	await page.locator('article.card', { hasText: 'Mineralvatten' }).locator('.add-round').click();
	await page.goto('/checkout');
	await page.waitForLoadState('networkidle');
	await page.locator('#co-phone').fill('0701234567');
	const place = page.getByRole('button', { name: /Lägg beställning och betala/ }).last();
	await expect(place).toBeEnabled({ timeout: 15000 });
	await place.click();
	await expect(page).toHaveURL(/\/orders\/(.+)\/pay/, { timeout: 30000 });
	const orderId = page.url().match(/\/orders\/(.+)\/pay/)?.[1];
	expect(orderId).toBeTruthy();
	await page.goto(`/orders/${orderId}`);
	// The page shows the restaurant's daily order number, not the document id.
	await expect(page.getByText(/Beställning #\d+/).first()).toBeVisible({
		timeout: 15000
	});
});
