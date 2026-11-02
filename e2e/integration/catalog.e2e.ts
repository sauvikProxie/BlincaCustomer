import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../support/signIn';

test.use({ storageState: STORAGE_STATE });

/**
 * Real catalog (marketplace seed): home grid names match restaurants.list and
 * the restaurant page renders the real menu with add-on groups.
 */
test('home shows real restaurants from the backend', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const band = page.locator('#all-restaurants');
	await expect(band).toBeVisible();
	await expect(band.getByText('Blinca Demo').first()).toBeVisible();
});

test('restaurant page shows the real menu', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Blinca Demo');
	await expect(page.getByText('Margherita').first()).toBeVisible();
});

test('item modal shows required add-on group before adding', async ({ page }) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await page.getByText('Klassisk burgare').first().click();
	const modal = page.locator('.modal-item');
	await expect(modal).toBeVisible();
	await expect(modal.locator('legend', { hasText: 'Välj dipsås' })).toBeVisible();
});
