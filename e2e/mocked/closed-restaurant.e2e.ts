import { expect, test } from '@playwright/test';
import { open, seedEmpty, tr } from './support';

// Design-check sample data: sushi-sakura is closed (opens 16:00), bangkok-street is paused.
test('a closed restaurant shows the closed banner and cannot take adds', async ({ page }, info) => {
	await seedEmpty(page);
	await open(page, '/restaurants/sushi-sakura');
	await expect(page.locator('.note-banner')).toHaveText(
		tr(info, 'rest.closedBanner', { time: '16:00' })
	);
	await expect(page.getByRole('button', { name: /^(Add|Lägg till) / })).not.toHaveCount(0);
	for (const b of await page.getByRole('button', { name: /^(Add|Lägg till) / }).all())
		await expect(b).toBeDisabled();
});

test('a paused restaurant shows the paused banner', async ({ page }, info) => {
	await seedEmpty(page);
	await open(page, '/restaurants/bangkok-street');
	await expect(page.locator('.note-banner')).toHaveText(tr(info, 'rest.pausedBanner'));
});

test('checkout with a closed restaurant stays disabled and says why', async ({ page }, info) => {
	await seedEmpty(page, {
		cart: [
			{
				key: 'sushi-sakura|sushi-12|{}',
				slug: 'sushi-sakura',
				itemId: 'sushi-12',
				opts: {},
				qty: 2
			}
		]
	});
	await open(page, '/checkout');
	await page.getByLabel(tr(info, 'co.phone'), { exact: true }).fill('70 123 45 67');
	await expect(page.locator('.co-summary .btn-primary')).toBeDisabled();
	await expect(page.locator('.co-summary .hint')).toHaveText(
		tr(info, 'rest.notTaking', { name: 'Sushi Sakura' })
	);
});
