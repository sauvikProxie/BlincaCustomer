import { expect, test, type Page } from '@playwright/test';
import { STORAGE_STATE } from './support/signIn';

test.use({ storageState: STORAGE_STATE });

/**
 * /orders/[orderId]/pay/return calls payments.sync (a Convex action over the
 * WebSocket). It must not run without a Convex session, and must run at most
 * once on load. Sync frames are counted and dropped, so nothing reaches Mollie
 * or the database.
 */

async function countSyncFrames(page: Page): Promise<() => number> {
	let n = 0;
	await page.routeWebSocket(/\/api\/[\d.]+\/sync/, (ws) => {
		const server = ws.connectToServer();
		ws.onMessage((msg) => {
			if (typeof msg === 'string' && msg.includes('"Action"') && msg.includes('payments:sync')) {
				n++;
				return; // dropped: never reaches the backend
			}
			server.send(msg);
		});
		server.onMessage((msg) => ws.send(msg));
	});
	return () => n;
}

async function ownedOrderId(page: Page): Promise<string | null> {
	await page.goto('/account?tab=orders');
	const href = await page
		.locator('a[href^="/orders/"]')
		.first()
		.getAttribute('href', { timeout: 10_000 })
		.catch(() => null);
	return href?.match(/^\/orders\/([^/?#]+)/)?.[1] ?? null;
}

test('signed in: sync runs exactly once on load', async ({ page }) => {
	const orderId = await ownedOrderId(page);
	test.skip(!orderId, 'No order in the seed for this customer.');

	const syncCalls = await countSyncFrames(page);
	await page.goto(`/orders/${orderId}/pay/return`);
	await expect(page.getByTestId('pay-return')).toBeVisible();
	await page.waitForTimeout(3000); // under the 5 s poll interval

	expect(syncCalls()).toBe(1);
	await expect(page.getByTestId('pay-signin')).toHaveCount(0);
});

test('no Convex session: no sync call, and a sign-in prompt with a login link', async ({
	page
}) => {
	const orderId = await ownedOrderId(page);
	test.skip(!orderId, 'No order in the seed for this customer.');

	// The server guard still sees the cookie; the Convex token is what is missing.
	await page.route(/\/api\/auth\/convex\/token/, (route) =>
		route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
	);
	const syncCalls = await countSyncFrames(page);
	await page.goto(`/orders/${orderId}/pay/return`);

	await expect(page.getByTestId('pay-signin')).toBeVisible({ timeout: 15_000 });
	await expect(page.getByTestId('pay-signin-link')).toHaveAttribute(
		'href',
		`/login?next=${encodeURIComponent(`/orders/${orderId}/pay/return`)}`
	);
	await page.waitForTimeout(6000); // past one poll interval
	expect(syncCalls()).toBe(0);
});
