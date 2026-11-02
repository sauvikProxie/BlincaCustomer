import { expect, test } from '@playwright/test';
import { open, seedEmpty, tr } from './support';

test.beforeEach(async ({ page }) => {
	await seedEmpty(page);
});

test('the offline banner appears when the browser goes offline and clears when it is back', async ({
	page,
	context
}, info) => {
	await open(page, '/');
	const banner = page.getByRole('status').filter({ hasText: tr(info, 'offline_banner') });
	await expect(banner).toHaveCount(0);
	await context.setOffline(true);
	await expect(banner).toBeVisible();
	await context.setOffline(false);
	await expect(banner).toHaveCount(0);
});

test('an unknown URL shows the 404 page with a way home', async ({ page }, info) => {
	const res = await page.goto('/this-page-does-not-exist');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr(info, 'nf.heading'));
	// The 404 page has exactly one main landmark, and the heading sits inside it.
	await expect(page.getByRole('main')).toHaveCount(1);
	await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: tr(info, 'nf.home') })).toHaveAttribute('href', '/');
	await expect(page.getByRole('button', { name: tr(info, 'error_retry') })).toHaveCount(0);
});
