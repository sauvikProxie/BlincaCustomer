import { expect, test } from '@playwright/test';
import { noHScroll, open, seedEmpty, tr } from './support';

// At <=760px the header keeps a compact language pill (globe + code); the footer
// switch remains too. The component is also covered in
// src/lib/components/LangMenu.svelte.test.ts.

test.beforeEach(async ({ page }) => {
	await seedEmpty(page);
});

test('desktop menu: opens, Escape closes and returns focus, selecting sets the cookie', async ({
	page,
	context
}, info) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await open(page, '/');
	const btn = page
		.getByRole('button', { name: tr(info, 'header.language'), exact: false })
		.locator('visible=true');
	await btn.click();
	await expect(btn).toHaveAttribute('aria-expanded', 'true');
	const menu = page.getByRole('menu', { name: tr(info, 'header.language') });
	await expect(menu.getByRole('menuitemradio')).toHaveCount(2);
	await menu.getByRole('menuitemradio').first().focus();
	await page.keyboard.press('Escape');
	await expect(menu).toHaveCount(0);
	await expect(btn).toBeFocused();

	const other = info.project.name === 'en' ? 'sv' : 'en';
	await btn.click();
	await menu.getByRole('menuitemradio', { name: other === 'sv' ? /Svenska/ : /English/ }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', other);
	expect((await context.cookies()).find((c) => c.name === 'PARAGLIDE_LOCALE')?.value).toBe(other);
});

test('at 390px the footer switches language and sets the cookie', async ({
	page,
	context
}, info) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page, '/');
	const other = info.project.name === 'en' ? 'sv' : 'en';
	await page
		.locator('#site-footer')
		.getByRole('button', { name: other === 'sv' ? 'Svenska' : 'English' })
		.click();
	await expect(page.locator('html')).toHaveAttribute('lang', other);
	expect((await context.cookies()).find((c) => c.name === 'PARAGLIDE_LOCALE')?.value).toBe(other);
});

for (const width of [360, 390]) {
	test(`at ${width}px the header has a language switch that opens, switches and fits`, async ({
		page,
		context
	}, info) => {
		await page.setViewportSize({ width, height: 800 });
		await open(page, '/');
		const pill = page.locator('header.hdr .lang-pill');
		await expect(pill).toBeVisible();
		const box = (await pill.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.x + box.width).toBeLessThanOrEqual(width);
		expect(await noHScroll(page)).toBe(true);

		await pill.click();
		const other = info.project.name === 'en' ? 'sv' : 'en';
		const row = page.getByRole('menuitemradio', { name: other === 'sv' ? 'Svenska' : 'English' });
		await expect(row).toBeVisible();
		const menu = (await row.boundingBox())!;
		expect(menu.x).toBeGreaterThanOrEqual(0);
		expect(menu.x + menu.width).toBeLessThanOrEqual(width);
		await row.click();
		await expect(page.locator('html')).toHaveAttribute('lang', other);
		expect((await context.cookies()).find((c) => c.name === 'PARAGLIDE_LOCALE')?.value).toBe(other);
	});
}

test('desktop menu: Escape closes it while focus is still on the trigger', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await open(page, '/');
	const btn = page
		.getByRole('button', { name: tr(info, 'header.language'), exact: false })
		.locator('visible=true');
	await btn.click();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('menu', { name: tr(info, 'header.language') })).toHaveCount(0);
});
