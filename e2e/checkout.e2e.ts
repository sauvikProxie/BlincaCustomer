import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { STORAGE_STATE } from './support/signIn';

/**
 * Checkout (/checkout → /orders/[id]/pay). Runs against the live stack with
 * all three seeds (signed in via the shared session, except the login test):
 *
 *   cd packages/backend && bun run dev                       # terminal 1
 *   cd apps/customer && bun run dev                           # terminal 2
 *   cd packages/backend && bun run seed:customer \
 *     && bun run seed:marketplace && bun run seed:dev
 *   CUSTOMER_BASE_URL=http://localhost:5173 \
 *     bunx playwright test e2e/checkout.e2e.ts --project=chromium
 *
 * Fixed seed facts: blinca-demo is open around the clock with Mineralvatten
 * (22 kr, no variants: one click adds it) and Kebabpizza (required dip
 * group). The cart is per-customer, so every test starts by emptying it.
 */

const DEMO = '/restaurants/blinca-demo';

async function clearCart(page: Page) {
	await page.goto('/cart');
	while ((await page.getByTestId('cart-remove').count()) > 0) {
		await page.getByTestId('cart-remove').first().click();
	}
	await expect(page.getByTestId('cart-body')).toContainText('Varukorgen är tom');
}

async function quickAddMineralvatten(page: Page) {
	await page.goto(DEMO);
	const row = page
		.getByRole('button', { name: /Läs mer om Mineralvatten/ })
		.locator('xpath=ancestor::article[1]');
	await row.getByRole('button', { name: 'Lägg till' }).click();
	await expect(page.getByTestId('header-cart-count')).toHaveText('1');
}

async function fillNewAddress(page: Page) {
	const newRadio = page.getByTestId('co-address-new');
	if (await newRadio.isVisible()) {
		await newRadio.check();
	}
	await page.getByTestId('co-street').fill('Testgatan 1');
	await page.getByTestId('co-postal').fill('113 31');
	await page.getByTestId('co-city').fill('Stockholm');
}

test.describe('authenticated', () => {
	test.use({ storageState: STORAGE_STATE });

	test.beforeEach(async ({ page }) => {
		await clearCart(page);
	});

	test('full path: add, cart, checkout, place order, pay stub', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/cart');
		await page.getByTestId('cart-checkout').click();
		await page.waitForURL('/checkout');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kassan');
		await expect(page.getByTestId('checkout-total')).toContainText('22 kr');

		// blinca-demo has no delivery zones, so the happy path uses pickup.
		await page.getByTestId('co-pickup').click();
		await page.getByTestId('co-phone').fill('0701234567');
		await page.getByTestId('checkout-submit').click();
		await expect(page).toHaveURL(/\/orders\/.+\/pay/);

		await expect(page.getByTestId('pay-status')).toHaveText('Väntar på betalning');
		await expect(page.getByTestId('pay-total')).toContainText(/kr/);
		await expect(page.getByTestId('pay-page')).toContainText('Mineralvatten');

		await clearCart(page);
	});

	test('unserved postal code shows the message and blocks submit', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/checkout');
		await fillNewAddress(page);
		await page.getByTestId('co-postal').fill('99999');
		await expect(page.getByTestId('co-zone')).toContainText('levererar inte');
		await page.getByTestId('co-phone').fill('0701234567');
		await expect(page.getByTestId('checkout-submit')).toHaveAttribute('aria-disabled', 'true');
	});

	test('empty phone focuses the phone field on submit', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/checkout');
		await fillNewAddress(page);
		await page.getByTestId('checkout-submit').click();
		await expect(page.locator('#co-phone')).toBeFocused();
	});

	test('scheduled slot can be picked', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/checkout');
		await fillNewAddress(page);
		await page.getByTestId('co-phone').fill('0701234567');
		await page.getByTestId('co-scheduled').click();
		const slot = page.getByTestId('co-slot').first();
		await expect(slot).toBeVisible();
		await slot.click();
		await expect(slot).toHaveAttribute('aria-pressed', 'true');
	});

	test('/checkout works at 320px with no horizontal scroll', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto('/checkout');
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth
		);
		expect(overflow).toBeLessThanOrEqual(1);
	});

	test('keyboard-only run completes an order', async ({ page }) => {
		await page.goto(DEMO);
		// Add with the keyboard: open the row, tab to Add, confirm.
		const row = page.getByRole('button', { name: /Läs mer om Mineralvatten/ });
		await row.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('item-modal')).toBeVisible();
		for (let i = 0; i < 20; i++) {
			await page.keyboard.press('Tab');
			const testid = await page.evaluate(
				() => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? ''
			);
			if (testid === 'modal-add') break;
		}
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('item-modal')).toBeHidden();

		await page.goto('/checkout');
		// Through the form by keyboard only: pickup, phone, submit.
		for (let i = 0; i < 40; i++) {
			await page.keyboard.press('Tab');
			const testid = await page.evaluate(
				() => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? ''
			);
			const id = await page.evaluate(
				() => (document.activeElement as HTMLElement | null)?.id ?? ''
			);
			if (testid === 'co-pickup') await page.keyboard.press('Space');
			if (id === 'co-phone') await page.keyboard.type('0701234567');
			if (testid.startsWith('co-')) {
				const ring = await page.evaluate(() => {
					const el = document.activeElement as HTMLElement | null;
					if (!el) return null;
					const cs = getComputedStyle(el);
					return { width: cs.outlineWidth, color: cs.outlineColor };
				});
				expect(ring?.width).toBe('3px');
				expect(ring?.color).toBe('rgb(255, 176, 32)');
			}
			if (testid === 'checkout-submit') break;
		}
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/orders\/.+\/pay/, { timeout: 15000 });
		await clearCart(page);
	});

	test('English renders checkout and the pay stub', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/');
		await page.evaluate(() => {
			document.cookie = 'PARAGLIDE_LOCALE=en; path=/';
		});
		await page.goto('/checkout');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Checkout');
		await expect(page.getByTestId('checkout-submit')).toContainText('Place order and pay');
	});
});

// ASAP needs a closed restaurant WITH a menu to be testable; none is
// seeded. Same env-gate pattern as SECOND_MENU_SLUG in cart.e2e.ts.
const closedSlug = process.env.CLOSED_MENU_SLUG;
test(
	closedSlug
		? 'ASAP is disabled with a reason when closed'
		: 'ASAP disabled when closed (skipped: set CLOSED_MENU_SLUG)',
	async ({ page }) => {
		test.skip(!closedSlug, 'Set CLOSED_MENU_SLUG to a closed restaurant with a menu.');
		await page.goto(`/restaurants/${closedSlug}`);
		await page.getByTestId('menu-item-row').first().getByRole('button').first().click();
		await expect(page.getByTestId('item-modal')).toBeVisible();
		await page.getByTestId('modal-add').click();
		await page.goto('/checkout');
		await expect(page.getByTestId('co-asap')).toBeDisabled();
		await expect(page.getByTestId('co-asap-reason')).toBeVisible();
	}
);

test('signed-out checkout redirects to login with a return URL', async ({ page }) => {
	await page.goto('/checkout');
	await page.waitForURL(/\/login\?next=/);
	expect(page.url()).toContain(encodeURIComponent('/checkout'));
});

test.describe('accessibility', () => {
	test.use({ storageState: STORAGE_STATE });

	test.beforeEach(async ({ page }) => {
		await clearCart(page);
		await quickAddMineralvatten(page);
	});

	test('checkout page passes axe', async ({ page }) => {
		await page.goto('/checkout');
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations, JSON.stringify(results.violations)).toEqual([]);
	});
});

test.describe('screenshots', () => {
	test.use({ storageState: STORAGE_STATE });

	test.beforeEach(async ({ page }) => {
		await clearCart(page);
		await quickAddMineralvatten(page);
	});

	for (const width of [320, 390, 1280]) {
		test(`checkout at ${width}px (light)`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: 'light' });
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/checkout');
			await page.screenshot({
				path: `e2e/screenshots/checkout-${width}.png`,
				fullPage: true
			});
		});
	}
});
