/* Pay-return page: a cancelled/rejected order is never offered "Try again";
   a plainly failed payment still is. Convex hooks are mocked. */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { getFunctionName } from 'convex/server';

const h = vi.hoisted(() => ({ queries: {} as Record<string, unknown> }));

vi.mock('convex-svelte', () => ({
	useAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useQuery: (fn: unknown) => ({
		get data() {
			return h.queries[getFunctionName(fn as never)];
		}
	}),
	useAction: () => vi.fn(async () => null)
}));
vi.mock('$app/env/public', () => ({
	PUBLIC_CONVEX_URL: 'http://127.0.0.1:1',
	PUBLIC_MAPBOX_ACCESS_TOKEN: ''
}));

import ReturnPage from '../../routes/(app)/(protected)/orders/[orderId]/pay/return/+page.svelte';
import { m } from '#lib/paraglide/messages.js';

const show = (status: string, paymentStatus: string) => {
	h.queries['customer/payments:getStatus'] = {
		orderId: 'o1',
		status,
		paymentStatus,
		dailyNumber: null
	};
	render(ReturnPage, { data: { orderId: 'o1' } } as never);
};

beforeEach(() => {
	h.queries = {};
});

describe('pay return', () => {
	test.each([
		['cancelled', 'failed'],
		['rejected', 'expired'],
		['cancelled', 'unpaid']
	])('%s order (payment %s): clear message, no retry', async (status, paymentStatus) => {
		show(status, paymentStatus);
		await expect.element(page.getByText(m.pay_error_order_not_payable())).toBeVisible();
		await expect.element(page.getByTestId('pay-retry')).not.toBeInTheDocument();
	});

	test('a failed payment on a still-payable order offers a retry', async () => {
		show('awaiting_payment', 'failed');
		await expect.element(page.getByTestId('pay-retry')).toBeVisible();
	});
});
