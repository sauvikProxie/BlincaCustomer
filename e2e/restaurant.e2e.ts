import { expect, test } from '@playwright/test';

/**
 * Public restaurant route (/restaurants/[slug]). Runs against the live stack
 * with the marketplace seed (bun run seed:marketplace), no sign-in needed:
 *
 *   CUSTOMER_BASE_URL=http://localhost:5173 \
 *     bunx playwright test e2e/restaurant.e2e.ts --no-deps --project=chromium
 *
 * Seed facts used below (packages/backend/convex/seedMarketplace.ts): the
 * marketplace restaurants have no opening-hours rows, so they render "closed";
 * "bangkok-street" has isAcceptingOrders=false, so it renders paused.
 */

test('an unknown slug returns 404', async ({ page }) => {
	const response = await page.goto('/restaurants/not-a-real-restaurant');
	expect(response?.status()).toBe(404);
});

test('a closed restaurant renders "closed" on the first server render, no JS', async ({
	browser
}) => {
	// JavaScript disabled: this asserts the SERVER computed the status (SEO,
	// direct URLs) without any client hydration.
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/restaurants/pizzeria-vesuvio');
	await expect(page.getByTestId('status-banner')).toHaveAttribute('data-kind', 'closed');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Pizzeria Vesuvio');
	await context.close();
});

test('a paused restaurant shows a paused status', async ({ page }) => {
	await page.goto('/restaurants/bangkok-street');
	const status = page.getByTestId('status-banner');
	await expect(status).toBeVisible();
	expect(await status.getAttribute('data-kind')).toMatch(/^paused_/);
});

// The live open→closed flip needs a restaurant that is open at run time (its
// own opening hours covering "now" on the server). The marketplace seed has no
// such row, so provide one and pass OPEN_RESTAURANT_SLUG to exercise it.
const openSlug = process.env.OPEN_RESTAURANT_SLUG;
test(
	openSlug
		? 'open restaurant flips to closed when the clock passes closing'
		: 'open→closed flip (skipped: set OPEN_RESTAURANT_SLUG)',
	async ({ page }) => {
		test.skip(!openSlug, 'Set OPEN_RESTAURANT_SLUG to a restaurant that is open now.');
		// Freeze the browser clock just before closing, then advance past it and
		// assert the status flips with no reload.
		await page.clock.install();
		await page.goto(`/restaurants/${openSlug}`);
		await expect(page.getByTestId('status-banner')).toHaveAttribute('data-kind', 'open');
		// Advance a day; any real closing time is crossed, so the client recomputes.
		await page.clock.fastForward('24:00:00');
		await expect(page.getByTestId('status-banner')).not.toHaveAttribute('data-kind', 'open');
	}
);

// Ordering enforcement lives in a customerMutation (cart/checkout) that lands in
// Steps 5–6. Until one calls assertRestaurantCanOrder, the RESTAURANT_CLOSED
// path is covered by the backend unit tests (restaurantOrderError). Re-enable
// this once the cart mutation exists.
test.skip('adding an item while closed fails with RESTAURANT_CLOSED', async () => {
	// Placeholder: Step 5/6 wires the guard into a mutation the page can call.
});
