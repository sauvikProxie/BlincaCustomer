import { expect, test } from '@playwright/test';

/**
 * The menu loads after the restaurant list; when that call fails the page must
 * say so and offer a retry instead of rendering an empty menu. Needs the seeded
 * marketplace (seed:marketplace), like the other public-browse specs.
 */
test('a failed menu load shows an error with a working retry', async ({ page }) => {
	await page.goto('/');
	const card = page.locator('a[href^="/restaurants/"]').first();
	test.skip((await card.count()) === 0, 'No restaurants in the seed.');

	let blocked = true;
	await page.route(/\/api\/query/, async (route) => {
		const body = route.request().postData() ?? '';
		if (blocked && body.includes('customer/menu:getForRestaurant')) return route.abort();
		return route.continue();
	});

	await card.click(); // client-side navigation runs the menu load in the browser
	await expect(page.getByTestId('menu-error')).toBeVisible();

	blocked = false;
	await page.getByTestId('menu-error').getByRole('button').click();
	await expect(page.getByTestId('menu-error')).toHaveCount(0);
});
