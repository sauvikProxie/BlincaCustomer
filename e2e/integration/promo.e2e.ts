import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../support/signIn';
import { clearCart } from '../support/cart';

test.use({ storageState: STORAGE_STATE });

/**
 * Real promo codes (dev-seeded LUNCH10 = plain 10%, no limits).
 * Mineralvatten 22 kr + 39 kr fee: discount 2 kr, total 59 kr.
 */
test('valid code shows discount line and reduced total, then removes', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await clearCart(page);
	await page.locator('article.card', { hasText: 'Mineralvatten' }).locator('.add-round').click();
	await page.goto('/checkout');
	await page.waitForLoadState('networkidle');
	const summary = page.locator('.co-summary');
	await expect(summary.getByText('Totalt', { exact: true })).toBeVisible();
	const promoForm = summary.locator('form.promo-row');
	await promoForm.locator('input[name="code"]').fill('LUNCH10');
	await promoForm.getByRole('button', { name: 'Använd' }).click();
	const okRow = summary.locator('.promo-row.is-ok');
	await expect(okRow).toContainText('LUNCH10', { timeout: 15000 });
	await expect(summary.getByText('Rabatt')).toBeVisible();
	await expect(summary.getByText('Totalt', { exact: true }).locator('..')).toContainText(
		/58[.,]8\d* kr/
	);
	await okRow.getByRole('button', { name: 'Ta bort' }).click();
	await expect(summary.locator('.promo-row.is-ok')).toHaveCount(0);
	await expect(summary.getByText('Totalt', { exact: true }).locator('..')).toContainText('61 kr');
});

test('unknown code shows the backend reason', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await clearCart(page);
	await page.locator('article.card', { hasText: 'Mineralvatten' }).locator('.add-round').click();
	await page.goto('/checkout');
	await page.waitForLoadState('networkidle');
	const summary = page.locator('.co-summary');
	const promoForm = summary.locator('form.promo-row');
	await promoForm.locator('input[name="code"]').fill('BADCODE');
	await promoForm.getByRole('button', { name: 'Använd' }).click();
	await expect(summary.locator('p.form-err')).toContainText('Koden känns inte igen', {
		timeout: 15000
	});
	await clearCart(page);
});
