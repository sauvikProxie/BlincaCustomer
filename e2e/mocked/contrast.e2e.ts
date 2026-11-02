/*
 * WCAG AA colour contrast (audit A03) in design-check mode, which has the sample offers,
 * orders and tracking that the real-mode scan cannot reach: home with its deals, the offers
 * drawer, the order tracking page, account, restaurant, checkout, login. axe color-contrast
 * must report 0 violations at 390 and 1366 px. The production-build scan covers the real routes.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { open } from './support';

const contrast = async (page: Page) => {
	const r = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
	return r.violations.flatMap((v) =>
		v.nodes.map(
			(n) =>
				`${n.target.join(' ')} ${n.any[0]?.data?.fgColor}/${n.any[0]?.data?.bgColor} ${n.any[0]?.data?.contrastRatio} ${n.any[0]?.data?.fontSize}`
		)
	);
};

for (const width of [390, 1366]) {
	test.describe(`${width}px`, () => {
		test.beforeEach(async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
		});

		for (const [name, url] of [
			['home', '/'],
			['restaurant', '/restaurants/blinca-demo'],
			['login', '/login'],
			['signup', '/login?mode=signup'],
			['info', '/info/help'],
			['account', '/account'],
			['account orders', '/account?tab=orders'],
			['checkout', '/checkout'],
			['order tracking', '/orders/BL-10424']
		] as const) {
			test(`${name} has no colour-contrast violations`, async ({ page }) => {
				await open(page, url);
				await page.waitForTimeout(500);
				expect(await contrast(page)).toEqual([]);
			});
		}

		test('the offers drawer (red, dark and pink offer cards) has none', async ({ page }) => {
			await open(page, '/');
			await page.locator('.offers-seeall').click();
			await expect(page.locator('.offer.theme-red').first()).toBeVisible();
			expect(await contrast(page)).toEqual([]);
		});
	});
}
