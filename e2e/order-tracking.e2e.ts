import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from './support/signIn';

test.use({ storageState: STORAGE_STATE });

/**
 * Order tracking (/orders/[orderId]) — the live status timeline. Runs signed in
 * against the live stack (seed:dev + seed:marketplace); the setup project saves
 * the session that test.use(storageState) reuses:
 *
 *   CUSTOMER_BASE_URL=http://localhost:5173 \
 *     bunx playwright test e2e/order-tracking.e2e.ts --project=chromium
 *
 * The closed-restaurant-blocked, sold-out-item and cart→checkout→pay-stub flows
 * are covered by checkout.e2e.ts / restaurant-detail.e2e.ts; this file covers
 * the tracking timeline itself.
 */

test('the active order links to a live tracking timeline', async ({ page }) => {
	await page.goto('/dashboard');
	const track = page.locator('a.track[href^="/orders/"]').first();
	// The seed may not include an in-flight order for this customer; skip cleanly.
	if ((await track.count()) === 0) {
		test.skip(true, 'No active order in the seed for this customer.');
	}
	await track.click();

	await expect(page.getByTestId('order-track-page')).toBeVisible();
	await expect(page.getByTestId('order-timeline')).toBeVisible();
	await expect(page.getByTestId('order-status')).toHaveAttribute(
		'data-status',
		/^(new|accepted|ready|picked_up)$/
	);
	// The timeline always renders its five steps.
	await expect(page.getByTestId('order-timeline').locator('li')).toHaveCount(5);
});

test('an unknown order id shows the not-found block, not an order', async ({ page }) => {
	await page.goto('/orders/not-a-real-order');
	await expect(page.getByTestId('order-timeline')).toHaveCount(0);
	await expect(page.locator('main a[href="/account?tab=orders"]')).toBeVisible();
});

// Driving accepted → ready → picked up live needs a partner/courier action to
// advance the order, which the customer app cannot trigger. Enable once a dev
// harness (or the partner e2e) can advance a specific order's status; the
// timeline/toast logic itself is covered by the unit tests
// (src/lib/order/timeline.test.ts and the backend isRunningLate test).
test.skip('status change pushes a toast and advances the timeline', async () => {
	// Placeholder: advance the order partner-side, then assert the toast appears
	// and the current step moves without a reload.
});
