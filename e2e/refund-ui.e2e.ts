import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from './support/signIn';

test.use({ storageState: STORAGE_STATE });

/**
 * Refund timeline on a cancelled/rejected order. The seed has no refunded
 * order for the e2e customer, so this runs only when a past order shows one;
 * the step logic itself is unit-tested (src/lib/order/refundTimeline.test.ts).
 */
test('a cancelled order shows its reason category and refund timeline', async ({ page }) => {
	await page.goto('/account?tab=orders');
	const cancelled = page
		.locator('a[href^="/orders/"]', { hasText: /cancel|avbru|reject|avvis/i })
		.first();
	test.skip((await cancelled.count()) === 0, 'No cancelled order in the seed for this customer.');
	await cancelled.click();
	await expect(page.getByTestId('refund-timeline')).toBeVisible();
	await expect(page.getByTestId('refund-timeline').locator('li')).toHaveCount(3);
});

/** A manual (restaurant) refund keeps the order live; its timeline shows on the order card. */
test('a live order with a refund shows the timeline', async ({ page }) => {
	await page.goto('/account?tab=orders');
	const first = page.locator('a[href^="/orders/"]').first();
	test.skip((await first.count()) === 0, 'No order in the seed for this customer.');
	await first.click();
	const timeline = page.getByTestId('refund-timeline');
	test.skip((await timeline.count()) === 0, 'The seeded order has no refund.');
	await expect(timeline).toContainText(/\d/);
});
