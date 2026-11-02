import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { STORAGE_STATE, signIn, CUSTOMER_EMAIL, CUSTOMER_PASSWORD } from './support/signIn';

/**
 * Customer cart (/cart + drawer + header). Runs against the live stack with
 * all three seeds (the demo menu carries the orderable items):
 *
 *   cd packages/backend && bun run dev                       # terminal 1
 *   cd apps/customer && bun run dev                           # terminal 2
 *   cd packages/backend && bun run seed:customer \
 *     && bun run seed:marketplace && bun run seed:dev
 *   CUSTOMER_BASE_URL=http://localhost:5173 \
 *     bunx playwright test e2e/cart.e2e.ts --project=chromium
 *
 * Fixed seed facts (seed.ts + seedMenu.ts): blinca-demo ("Blinca Demo") is
 * open around the clock with Mineralvatten (22 kr, vegan, no variants) and
 * Kebabpizza (139 kr, "Välj dipsås" required). The cart is per-customer, so
 * every test starts by emptying it through the UI.
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

test.describe('authenticated', () => {
	test.use({ storageState: STORAGE_STATE });

	test.beforeEach(async ({ page }) => {
		await clearCart(page);
	});

	test('add from the restaurant page moves the header count', async ({ page }) => {
		await quickAddMineralvatten(page);
		await expect(page.getByTestId('header-cart-live')).toContainText('1 varor');
		await page.goto('/cart');
		await expect(page.getByTestId('cart-line')).toHaveCount(1);
		await expect(page.getByTestId('cart-subtotal')).toContainText('22 kr');
	});

	test('quantity stepper doubles the subtotal, remove empties the cart', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/cart');
		await page.getByTestId('cart-inc').click();
		await expect(page.getByTestId('cart-qty')).toHaveText('2');
		await expect(page.getByTestId('cart-subtotal')).toContainText('44 kr');
		await page.getByTestId('cart-dec').click();
		await expect(page.getByTestId('cart-qty')).toHaveText('1');
		await page.getByTestId('cart-remove').click();
		await expect(page.getByTestId('cart-body')).toContainText('Varukorgen är tom');
		await expect(page.getByTestId('header-cart-count')).toHaveCount(0);
	});

	test('checkout link navigates to /checkout', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/cart');
		const checkout = page.getByTestId('cart-checkout');
		// A non-blocking cart leaves the link live (no aria-disabled).
		await expect(checkout).not.toHaveAttribute('aria-disabled', 'true');
		await checkout.click();
		await expect(page).toHaveURL(/\/checkout$/);
	});

	test('/cart works at 320px with no horizontal scroll', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto('/cart');
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth
		);
		expect(overflow).toBeLessThanOrEqual(1);
	});

	test('keyboard order reaches every cart control with a visible ring', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/cart');
		await expect(page.getByTestId('cart-line')).toBeVisible();
		const seen: (string | null)[] = [];
		for (let i = 0; i < 30; i++) {
			await page.keyboard.press('Tab');
			const stop = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				return el?.getAttribute('data-testid') ?? null;
			});
			seen.push(stop);
			// Cart controls carry the 3px saffron ring.
			if (stop && stop.startsWith('cart-')) {
				const ring = await page.evaluate(() => {
					const el = document.activeElement as HTMLElement | null;
					if (!el) return null;
					const cs = getComputedStyle(el);
					return { width: cs.outlineWidth, color: cs.outlineColor };
				});
				expect(ring?.width).toBe('3px');
				expect(ring?.color).toBe('rgb(255, 176, 32)');
			}
			if (stop === 'cart-checkout') break;
		}
		const order = ['cart-dec', 'cart-inc', 'cart-remove', 'cart-checkout'].map((id) =>
			seen.indexOf(id)
		);
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
	});

	test('drawer opens from the dashboard with the same lines', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/dashboard');
		await page.getByRole('button', { name: /Varukorg|Öppna varukorgen/ }).click();
		await expect(page.getByTestId('cart-drawer')).toBeVisible();
		await expect(page.getByTestId('cart-drawer').getByTestId('cart-line')).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('cart-drawer')).toBeHidden();
	});

	test('page and open drawer pass axe', async ({ page }) => {
		await quickAddMineralvatten(page);
		await page.goto('/cart');
		const pageResults = await new AxeBuilder({ page }).analyze();
		expect(pageResults.violations, JSON.stringify(pageResults.violations)).toEqual([]);
		await page.goto('/dashboard');
		await page.getByRole('button', { name: /Varukorg|Öppna varukorgen/ }).click();
		await expect(page.getByTestId('cart-drawer')).toBeVisible();
		const drawerResults = await new AxeBuilder({ page }).analyze();
		expect(drawerResults.violations, JSON.stringify(drawerResults.violations)).toEqual([]);
	});

	test('English renders the cart', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			document.cookie = 'PARAGLIDE_LOCALE=en; path=/';
		});
		await page.goto('/cart');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cart');
		await expect(page.getByTestId('cart-body')).toContainText('Your cart is empty');
	});

	// A second orderable menu only exists if the seed grows one. Same pattern
	// as OPEN_RESTAURANT_SLUG in restaurant.e2e.ts: skip without it.
	const secondSlug = process.env.SECOND_MENU_SLUG;
	test(
		secondSlug
			? 'switching restaurant shows the confirm dialog'
			: 'switching restaurant (skipped: set SECOND_MENU_SLUG)',
		async ({ page }) => {
			test.skip(!secondSlug, 'Set SECOND_MENU_SLUG to an open restaurant with a menu.');
			await quickAddMineralvatten(page);
			await page.goto(`/restaurants/${secondSlug}`);
			// First row's main button (first button in DOM order): opens the modal.
			await page.getByTestId('menu-item-row').first().getByRole('button').first().click();
			await expect(page.getByTestId('item-modal')).toBeVisible();
			await page.getByTestId('modal-add').click();
			await expect(page.getByTestId('cart-conflict')).toBeVisible();
			await expect(page.getByTestId('cart-conflict')).toContainText('Blinca Demo');

			await page.getByTestId('conflict-keep').click();
			await expect(page.getByTestId('cart-conflict')).toBeHidden();
			await expect(page.getByTestId('header-cart-count')).toHaveText('1');

			await page.getByTestId('modal-add').click();
			await page.getByTestId('conflict-replace').click();
			await expect(page.getByTestId('cart-conflict')).toBeHidden();
		}
	);
});

test('signed-out add redirects to login and replays after sign-in', async ({ page }) => {
	await page.goto(DEMO);
	const row = page
		.getByRole('button', { name: /Läs mer om Mineralvatten/ })
		.locator('xpath=ancestor::article[1]');
	await row.getByRole('button', { name: 'Lägg till' }).click();
	await page.waitForURL(/\/login\?next=/);
	expect(page.url()).toContain(encodeURIComponent(DEMO));

	await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, DEMO);
	await page.waitForURL(DEMO);
	// The pending add replayed exactly once, then cleared.
	await expect(page.getByTestId('header-cart-count')).toHaveText('1');
	expect(await page.evaluate(() => sessionStorage.getItem('blinca-pending-cart'))).toBeNull();

	// Leave no trace for the other specs.
	await clearCart(page);
});

test.describe('screenshots', () => {
	test.use({ storageState: STORAGE_STATE });

	test.beforeEach(async ({ page }) => {
		await clearCart(page);
		await quickAddMineralvatten(page);
	});

	for (const width of [320, 390, 1280]) {
		test(`cart page at ${width}px (light)`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: 'light' });
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/cart');
			await page.screenshot({ path: `e2e/screenshots/cart-${width}.png`, fullPage: true });
		});
	}

	for (const width of [390, 1280]) {
		test(`cart drawer at ${width}px (light)`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: 'light' });
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/dashboard');
			await page.getByRole('button', { name: /Varukorg|Öppna varukorgen/ }).click();
			await expect(page.getByTestId('cart-drawer')).toBeVisible();
			await page.screenshot({ path: `e2e/screenshots/cart-drawer-${width}.png` });
		});
	}
});
