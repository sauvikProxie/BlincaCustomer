import { expect, test, type Page } from '@playwright/test';
import { STORAGE_STATE } from '../support/signIn';

test.use({ storageState: STORAGE_STATE });

// The customer's saved language decides the UI, so match both.
async function openDrawer(page: Page) {
	if (!(await page.locator('.drawer-cart').isVisible()))
		await page
			.getByRole('button', { name: /^(Varukorg|Cart)/ })
			.locator('visible=true')
			.first()
			.click();
	await expect(page.locator('.drawer-cart')).toBeVisible();
}
async function clearCart(page: Page) {
	await openDrawer(page);
	const remove = page.getByRole('button', { name: /^(Ta bort|Remove)/ });
	for (let i = 0; i < 10 && (await remove.count()) > 0; i++) {
		await remove.first().dispatchEvent('click');
		await page.waitForTimeout(1500);
	}
	await page.keyboard.press('Escape');
	await expect(page.locator('.drawer-wrap.is-open')).toHaveCount(0);
}

/**
 * Sizes end to end (live backend, seeded blinca-demo): Coca-Cola has two sizes
 * (33 cl 25 kr, 50 cl 32 kr). The size is a required choice shown with absolute
 * prices, the cart and checkout name it, and the order is priced at the size.
 */
test('an item with sizes: choose a size, cart and checkout show it, order is placed', async ({
	page
}) => {
	await page.goto('/restaurants/blinca-demo');
	await page.waitForLoadState('networkidle');
	await clearCart(page);

	// Menu card: "from" the cheapest size
	const card = page.locator('article', { hasText: 'Coca-Cola' }).first();
	await expect(card).toContainText('från 25 kr');

	await card.getByRole('button', { name: 'Coca-Cola', exact: true }).click();
	const modal = page.locator('.item-modal');
	await expect(modal).toBeVisible();
	await expect(modal.getByText('från 25 kr')).toBeVisible();
	await expect(modal.locator('legend', { hasText: 'Storlek' })).toBeVisible();
	// Required: nothing chosen, Add stays disabled
	const add = modal.locator('.im-foot .btn-primary');
	await expect(add).toBeDisabled();
	// Absolute prices on the tiles
	await expect(modal.getByRole('radio', { name: /33 cl/ })).toBeVisible();
	await expect(modal.locator('label', { hasText: '33 cl' })).toContainText('25 kr');
	await expect(modal.locator('label', { hasText: '50 cl' })).toContainText('32 kr');
	await modal.getByRole('radio', { name: /50 cl/ }).check();
	await expect(add).toBeEnabled();
	await expect(add).toContainText('32 kr');
	await add.click();

	// The cart drawer names the size
	// adding may open the drawer on its own
	await openDrawer(page);
	await expect(page.locator('.drawer-cart')).toContainText('Coca-Cola');
	await expect(page.locator('.drawer-cart')).toContainText('50 cl');
	await page.keyboard.press('Escape');

	// Checkout (pick-up) names it and prices the order at the size
	await page.goto('/checkout');
	await page.waitForLoadState('networkidle');
	await page
		.getByText(/^(Avhämtning|Pick-up)/)
		.locator('visible=true')
		.first()
		.click();
	await expect(page.locator('main')).toContainText('50 cl');
	await page.locator('#co-phone').fill('0701234567');
	const place = page.getByRole('button', { name: /Lägg beställning och betala/ }).last();
	await expect(place).toBeEnabled({ timeout: 15000 });
	await place.click();
	await expect(page).toHaveURL(/\/orders\/.+\/pay/, { timeout: 30000 });
	await expect(page.getByTestId('pay-total')).toContainText('32 kr');

	// The order page names the size the order was placed with
	const orderId = page.url().match(/\/orders\/([^/]+)\/pay/)![1];
	await page.goto(`/orders/${orderId}`);
	await expect(page.locator('.oc-items').first()).toContainText('Coca-Cola · 50 cl');
});

test('home search suggestions show "from" for an item with sizes', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.getByRole('searchbox').first().fill('Coca');
	await expect(page.getByText(/Blinca Demo · (från|from) 25 kr/).first()).toBeVisible();
});
