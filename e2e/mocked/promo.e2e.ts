import { expect, test } from '@playwright/test';
import { esc, open, tr } from './support';

// Default design-check seed: a signed-in user with 3 lines (kr 600+) from blinca-demo.
test.beforeEach(async ({ page }) => {
	await open(page, '/checkout');
});

const box = (page: import('@playwright/test').Page, info: import('@playwright/test').TestInfo) =>
	page.getByRole('textbox', { name: tr(info, 'promo.placeholder') });

test('an unknown code shows an alert message', async ({ page }, info) => {
	await box(page, info).fill('nope');
	await page.getByRole('button', { name: tr(info, 'promo.apply') }).click();
	await expect(
		page.getByRole('alert').filter({ hasText: tr(info, 'promo.unknown') })
	).toBeVisible();
});

test('a valid code is applied and can be removed', async ({ page }, info) => {
	await box(page, info).fill('forsta20');
	await page.getByRole('button', { name: tr(info, 'promo.apply') }).click();
	const row = page.locator('.promo-row.is-ok');
	await expect(row).toContainText('FORSTA20');
	await expect(row).toContainText('20 %');
	await row.getByRole('button', { name: tr(info, 'cart.remove') }).click();
	await expect(box(page, info)).toBeVisible();
});

test('a code that needs delivery is rejected for pick-up', async ({ page }, info) => {
	await page.getByRole('radio', { name: new RegExp('^' + esc(tr(info, 'co.pickup'))) }).click();
	await box(page, info).fill('HELG');
	await page.getByRole('button', { name: tr(info, 'promo.apply') }).click();
	await expect(
		page.getByRole('alert').filter({ hasText: tr(info, 'promo.deliveryOnly') })
	).toBeVisible();
});
