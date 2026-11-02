/*
 * Intended behaviours the design-match harness accepts as exceptions (see
 * e2e/design-match/masks.mjs and MIGRATION.md "Design-match exceptions"). The harness
 * hides each of them to compare the rest of the page pixel for pixel, so each one is
 * checked here instead. Runs in design-check mode, like the harness.
 */
import { expect, test } from '@playwright/test';
import { open } from './support';

test('contrast: brand stays the logo red, small brand text uses --brand-dark, green is darker (A03)', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page, '/login');
	const t = await page.evaluate(() => {
		const css = getComputedStyle(document.documentElement);
		const link = document.querySelector('.btn-link:not(.muted)');
		return {
			brand: css.getPropertyValue('--brand').trim().toUpperCase(),
			dark: css.getPropertyValue('--brand-dark').trim().toUpperCase(),
			green: css.getPropertyValue('--green').trim().toUpperCase(),
			linkColor: link ? getComputedStyle(link).color : null
		};
	});
	const lum = (hex: string) => {
		const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
		const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const ratio = (a: string, b: string) => {
		const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
		return (hi + 0.05) / (lo + 0.05);
	};
	expect(t.brand).toBe('#E23744'); // the logo's red
	expect(t.green).toBe('#2A7449');
	for (const bg of ['#FFFFFF', '#FFF7F5', '#FDE6E6'])
		expect(ratio(t.dark, bg)).toBeGreaterThanOrEqual(4.5);
	expect(ratio(t.green, '#E8F3EC')).toBeGreaterThanOrEqual(4.5);
	expect(t.linkColor).toBe('rgb(179, 33, 47)'); // small links are --brand-dark
	await open(page, '/');
	const label = await page
		.locator('.tabbar .is-here > span:nth-child(2)')
		.first()
		.evaluate((e) => getComputedStyle(e).color);
	expect(label).toBe('rgb(179, 33, 47)');
});

test('auth pages have no site header (login)', async ({ page }) => {
	await open(page, '/login');
	await expect(page.locator('#site-header')).toHaveCount(0);
	await expect(page.locator('.island-wrap')).toHaveCount(0);
});

test('text fields are 16px up to 1024px wide and 15px above (no iOS focus zoom)', async ({
	page
}) => {
	await page.setViewportSize({ width: 1024, height: 800 });
	await open(page, '/login');
	const size = () =>
		page
			.locator('input.field')
			.first()
			.evaluate((e) => getComputedStyle(e).fontSize);
	expect(await size()).toBe('16px');
	await page.setViewportSize({ width: 1280, height: 800 });
	expect(await size()).toBe('15px');
});

test('the open-now card keeps its pill and time inside the photo box', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await open(page, '/');
	const card = page.locator('.all-open-card').first();
	await expect(card.locator('.all-open-media .all-open-pill')).toHaveCount(1);
	await expect(card.locator('.all-open-media .all-open-time')).toHaveCount(1);
});

test('tracking map: 44px back button, restaurant marker is a pin', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page, '/orders/BL-10424');
	const box = (await page.locator('.map-back').boundingBox())!;
	expect(box.width).toBeGreaterThanOrEqual(44);
	expect(box.height).toBeGreaterThanOrEqual(44);
	const pin = page.locator('.rest-pin').first();
	await expect(pin.locator('path')).toHaveCount(1);
	await expect(pin.locator('text')).toHaveCount(0);
});

test('account: no demo card; receipts and address actions are there', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await open(page, '/account');
	await expect(page.getByText(/Demo data|Demodata/)).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Reset demo|Återställ demo/ })).toHaveCount(0);
	const receipt = page.locator('.receipt-btn').first();
	await expect(receipt).toBeVisible();
	await receipt.click();
	await expect(page.getByRole('dialog').locator('.rc-title')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('.addr-row > .icon-btn')).toHaveCount(4); // edit + delete for the two sample addresses
});
