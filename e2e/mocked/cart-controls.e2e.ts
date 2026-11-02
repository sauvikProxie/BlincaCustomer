import { expect, test } from '@playwright/test';
import { dish, open, seedEmpty, tr } from './support';

const WATER = { en: 'Sparkling water', sv: 'Bubbelvatten' };

test.describe('quantity steppers', () => {
	test.beforeEach(async ({ page }) => {
		await seedEmpty(page);
		await open(page, '/restaurants/blinca-demo');
	});

	test('add shows a stepper; inc, dec and dec-to-zero remove the line', async ({ page }, info) => {
		const name = WATER[info.project.name as 'en' | 'sv'];
		const qty = page.locator('#item-sparkling-water .stepper b');
		await page
			.locator('#item-sparkling-water')
			.getByRole('button', { name: tr(info, 'qty.add', { name }) })
			.click();
		await expect(qty).toHaveText('1');
		const more = page
			.locator('#item-sparkling-water')
			.getByRole('button', { name: tr(info, 'qty.more', { name }) });
		const less = page
			.locator('#item-sparkling-water')
			.getByRole('button', { name: tr(info, 'qty.less', { name }) });
		await more.click();
		await expect(qty).toHaveText('2');
		await less.click();
		await expect(qty).toHaveText('1');
		await less.click(); // below 1 removes the line: the plain add button is back
		await expect(page.locator('#item-sparkling-water .stepper')).toHaveCount(0);
		await expect(
			page
				.locator('#item-sparkling-water')
				.getByRole('button', { name: tr(info, 'qty.add', { name }) })
		).toBeVisible();
	});

	test('item modal stepper cannot go below 1', async ({ page }, info) => {
		await page
			.getByRole('button', { name: tr(info, 'qty.add', { name: dish(info, 'margherita') }) })
			.first()
			.click();
		const modal = page.locator('.item-modal');
		const name = dish(info, 'margherita');
		const less = modal.getByRole('button', { name: tr(info, 'qty.less', { name }) });
		await expect(less).toBeDisabled();
		await modal.getByRole('button', { name: tr(info, 'qty.more', { name }) }).click();
		await expect(less).toBeEnabled();
	});
});

test('on a closed restaurant add is disabled and + on an existing line is disabled', async ({
	page
}, info) => {
	await seedEmpty(page, {
		cart: [
			{
				key: 'sushi-sakura|sushi-12|{}',
				slug: 'sushi-sakura',
				itemId: 'sushi-12',
				opts: {},
				qty: 1
			}
		]
	});
	await open(page, '/restaurants/sushi-sakura');
	const name = tr(info, 'qty.add', {
		name: info.project.name === 'en' ? 'Salmon nigiri, 8 pieces' : 'Laxnigiri, 8 bitar'
	});
	await expect(page.getByRole('button', { name })).toBeDisabled();
	const sushi = info.project.name === 'en' ? 'Sushi mix, 12 pieces' : 'Sushimix, 12 bitar';
	await expect(
		page.getByRole('button', { name: tr(info, 'qty.more', { name: sushi }) })
	).toBeDisabled();
	await expect(
		page.getByRole('button', { name: tr(info, 'qty.less', { name: sushi }) })
	).toBeEnabled();
});
