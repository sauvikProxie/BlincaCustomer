import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../support/signIn';
import { clearCart } from '../support/cart';

test.use({ storageState: STORAGE_STATE });

function sek(text: string | null): number {
	const m = text?.replace(/\s/g, '').match(/(\d+)/);
	return m ? Number(m[1]) : NaN;
}

test('delivery and pickup totals are consistent (fee only on delivery)', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await clearCart(page);
	await page.locator('article.card', { hasText: 'Mineralvatten' }).locator('.add-round').click();
	await page.goto('/checkout');
	await page.waitForLoadState('networkidle');
	const summary = page.locator('.co-summary');
	await expect(summary).toBeVisible();
	const sub = sek(await summary.getByText('Delsumma').locator('..').textContent());
	const fee = sek(await summary.getByText('Leveransavgift').locator('..').textContent());
	const total = sek(await summary.getByText('Totalt', { exact: true }).locator('..').textContent());
	expect(sub).toBeGreaterThan(0);
	expect(total).toBe(sub + fee);
	await page.getByRole('radio', { name: /Avhämtning/ }).click();
	const pickupTotal = sek(
		await summary.getByText('Totalt', { exact: true }).locator('..').textContent()
	);
	expect(pickupTotal).toBe(sub);
	expect(pickupTotal).toBeLessThan(total);
});

test('placing the order creates it and lands on the pay page', async ({ page }) => {
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
	await expect(page.locator('[data-testid="pay-page"]')).toBeVisible();
	await expect(page.locator('[data-testid="pay-button"]')).toBeVisible();
});
