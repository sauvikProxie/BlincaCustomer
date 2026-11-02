import { expect, test } from '@playwright/test';
import { dish, esc, open, seedEmpty, tr } from './support';

// Design-check data: Margherita has an optional multi-select group (max 3),
// Classic burger has a required single-select "Sauce" group.
test.beforeEach(async ({ page }) => {
	await seedEmpty(page);
	await open(page, '/restaurants/blinca-demo');
});

const openBurger = async (
	page: import('@playwright/test').Page,
	info: import('@playwright/test').TestInfo
) => {
	await page
		.getByRole('button', { name: tr(info, 'qty.add', { name: dish(info, 'burger') }) })
		.first()
		.click();
	return page.locator('.item-modal');
};

test('a dish with options opens the item modal', async ({ page }, info) => {
	const modal = await openBurger(page, info);
	await expect(modal.getByRole('heading', { name: dish(info, 'burger') })).toBeVisible();
	await expect(modal.locator('.og').filter({ hasText: /Sauce|Sås/ })).toBeVisible();
});

test('a required option blocks add until chosen, then total updates', async ({ page }, info) => {
	const modal = await openBurger(page, info);
	const add = modal.locator('.im-foot .btn-primary');
	await expect(add).toBeDisabled();
	await expect(add).toHaveText(
		new RegExp(esc(tr(info, 'item.choose', { name: '' }).trim().split(' ')[0]))
	);
	await modal.getByRole('radio').first().check();
	await expect(add).toBeEnabled();
	const before = await add.innerText();
	await modal
		.getByRole('button', { name: tr(info, 'qty.more', { name: dish(info, 'burger') }) })
		.click();
	await expect(add).not.toHaveText(before);
	await expect(modal.locator('.im-foot .stepper b')).toHaveText('2');
});

test('optional extras add to the price and respect max', async ({ page }, info) => {
	await page
		.getByRole('button', { name: tr(info, 'qty.add', { name: dish(info, 'margherita') }) })
		.first()
		.click();
	const modal = page.locator('.item-modal');
	const add = modal.locator('.im-foot .btn-primary');
	await expect(add).toBeEnabled(); // extras are optional
	await expect(add).toContainText('119');
	await modal.getByRole('checkbox', { name: /cheese|ost/i }).check();
	await expect(add).toContainText('134');
	for (const n of [/Jalape/, /Mushrooms|Champinjoner/])
		await modal.getByRole('checkbox', { name: n }).check();
	// max 3 reached: the remaining boxes are disabled
	await expect(modal.getByRole('checkbox', { name: /Olives|Oliver/ })).toBeDisabled();
});

test('adding closes the modal and puts the line in the cart', async ({ page }, info) => {
	const modal = await openBurger(page, info);
	await modal.getByRole('radio').first().check();
	await modal.locator('.im-foot .btn-primary').click();
	await expect(modal).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: tr(info, 'qty.more', { name: dish(info, 'burger') }) }).first()
	).toBeVisible();
});
