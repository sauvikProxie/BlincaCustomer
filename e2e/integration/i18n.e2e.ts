import { expect, test } from '@playwright/test';

test('SV ⇄ EN switch re-renders the login page', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'Välkommen tillbaka' })).toBeVisible();
	// The login page has no header: the language switch lives in the footer.
	await page.getByRole('button', { name: 'English' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
	await page.getByRole('button', { name: 'Svenska' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'Välkommen tillbaka' })).toBeVisible();
});
