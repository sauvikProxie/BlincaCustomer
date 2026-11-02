import { expect, test } from '@playwright/test';
import { open, seedEmpty, tr } from './support';

// Design-check keeps saved addresses in localStorage, so add / edit / delete run
// against local state only. The mocked server has an empty Mapbox token, so the
// form shows no map (the fallback path).
test.beforeEach(async ({ page }) => {
	await seedEmpty(page);
	await open(page, '/account?tab=addresses');
});

const dialog = (page: import('@playwright/test').Page) => page.getByRole('dialog');

async function addAddress(
	page: import('@playwright/test').Page,
	info: import('@playwright/test').TestInfo,
	label: string
) {
	await page.getByRole('button', { name: tr(info, 'acc.addAddress') }).click();
	await dialog(page).getByLabel(tr(info, 'addr.label')).fill(label);
	await dialog(page).getByLabel(tr(info, 'co.street')).fill('Kungsgatan 1');
	await dialog(page).getByLabel(tr(info, 'co.zip')).fill('111 43');
	await dialog(page).getByLabel(tr(info, 'co.city')).fill('Stockholm');
	await dialog(page)
		.getByRole('button', { name: tr(info, 'addr.save') })
		.click();
}

test('saving an empty address form flags the required fields', async ({ page }, info) => {
	await page.getByRole('button', { name: tr(info, 'acc.addAddress') }).click();
	await dialog(page)
		.getByRole('button', { name: tr(info, 'addr.save') })
		.click();
	await expect(dialog(page).getByRole('alert')).toHaveText(tr(info, 'form.fix'));
	for (const l of ['co.street', 'co.zip', 'co.city'])
		await expect(dialog(page).getByLabel(tr(info, l))).toHaveAttribute('aria-invalid', 'true');
});

test('the form has no map without a Mapbox token and does not crash', async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.getByRole('button', { name: tr(info, 'acc.addAddress') }).click();
	await expect(dialog(page).getByLabel(tr(info, 'co.street'))).toBeVisible();
	await expect(dialog(page).locator('.am-wrap, #na-map-search')).toHaveCount(0);
	expect(errors).toEqual([]);
});

test('add, edit and delete an address', async ({ page }, info) => {
	await addAddress(page, info, 'Mamma');
	const row = page.locator('.addr-row').filter({ hasText: 'Mamma' });
	await expect(row).toContainText('Kungsgatan 1, 111 43 Stockholm');

	await row.getByRole('button', { name: `${tr(info, 'addr.edit')}: Mamma` }).click();
	await expect(dialog(page).getByLabel(tr(info, 'co.street'))).toHaveValue('Kungsgatan 1'); // prefilled
	await dialog(page).getByLabel(tr(info, 'co.street')).fill('Drottninggatan 9');
	await dialog(page)
		.getByRole('button', { name: tr(info, 'addr.save') })
		.click();
	await expect(page.locator('.addr-row').filter({ hasText: 'Mamma' })).toContainText(
		'Drottninggatan 9'
	);

	await page
		.locator('.addr-row')
		.filter({ hasText: 'Mamma' })
		.getByRole('button', { name: /: Mamma$/ })
		.last()
		.click();
	await expect(
		dialog(page).getByRole('heading', { name: tr(info, 'address_delete_title') })
	).toBeVisible();
	await dialog(page)
		.getByRole('button', { name: tr(info, 'common.cancel') })
		.click(); // cancel keeps it
	await expect(page.locator('.addr-row').filter({ hasText: 'Mamma' })).toHaveCount(1);

	await page
		.locator('.addr-row')
		.filter({ hasText: 'Mamma' })
		.getByRole('button', { name: /: Mamma$/ })
		.last()
		.click();
	await dialog(page)
		.getByRole('button', { name: tr(info, 'address_delete'), exact: true })
		.click();
	await expect(page.locator('.addr-row').filter({ hasText: 'Mamma' })).toHaveCount(0);
});
