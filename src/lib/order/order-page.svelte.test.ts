/*
 * Order page (orders/[orderId]/+page.svelte) with mocked Convex hooks: status
 * variants (new, accepted, ready, picked_up, rejected, cancelled, refund),
 * receipt button, rating stars, report-a-problem form incl. "already reported".
 * Design-check cannot represent these (they are driven by Convex queries).
 */
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { getFunctionName } from 'convex/server';

const h = vi.hoisted(() => ({
	queries: {} as Record<string, unknown>,
	mutations: {} as Record<string, ReturnType<typeof import('vitest').vi.fn>>,
	openReceipt: undefined as unknown
}));

vi.mock('convex-svelte', () => ({
	useAuth: () => ({ isAuthenticated: true }),
	useQuery: (fn: unknown) => ({
		get data() {
			return h.queries[getFunctionName(fn as never)];
		}
	}),
	useMutation: (fn: unknown) => {
		const name = getFunctionName(fn as never);
		return (h.mutations[name] ??= vi.fn(async () => null));
	}
}));
vi.mock('$app/env/public', () => ({
	PUBLIC_CONVEX_URL: 'http://127.0.0.1:1',
	PUBLIC_MAPBOX_ACCESS_TOKEN: ''
}));
// Not under test: the map (Mapbox), courier card, confirm dialog and receipt modal.
vi.mock('#lib/components/track/TrackMap.svelte', () => ({ default: () => {} }));
vi.mock('#lib/components/track/CourierCard.svelte', () => ({ default: () => {} }));
vi.mock('#lib/ui.js', () => ({ confirm: vi.fn() }));
vi.mock('#lib/order/openReceipt.js', () => ({ openReceipt: vi.fn() }));

import OrderPage from '../../routes/(app)/(protected)/orders/[orderId]/+page.svelte';
import { setSession } from '#lib/stores/session.svelte.js';
import { setOrdersCache } from '#lib/stores/orders.svelte.js';
import { t, lang } from '#lib/stores/language.svelte.js';
import { fmtTime } from '#lib/format.js';
import { m } from '#lib/paraglide/messages.js';
import { openReceipt } from '#lib/order/openReceipt.js';

const ID = 'ord1';
const NOW = Date.now();

function setup(
	timeline: Record<string, unknown>,
	opts: { fulfillment?: 'delivery' | 'pickup'; paymentStatus?: string; review?: unknown } = {}
) {
	const fulfillment = opts.fulfillment ?? 'delivery';
	setSession({ id: 'u1', name: 'Anna' }, null);
	setOrdersCache(
		[
			{
				_id: ID,
				restaurantId: 'r1',
				placedAt: NOW - 600_000,
				totalCents: 25000,
				deliveryFeeCents: 3900,
				fulfillment,
				paymentStatus: opts.paymentStatus ?? 'paid',
				status: timeline.status,
				deliveryAddress: { street: 'Storgatan 5', postalCode: '114 51', city: 'Stockholm' },
				items: [
					{
						nameSv: 'Margherita',
						nameEn: 'Margherita',
						quantity: 2,
						unitPriceCents: 11900,
						lineTotalCents: 23800
					}
				]
			}
		],
		() => ''
	);
	h.queries['customer/orderTracking:getTimeline'] = {
		placedAt: NOW - 600_000,
		fulfillment,
		dailyNumber: 7,
		...timeline
	};
	h.queries['customer/reviews:getMine'] = 'review' in opts ? opts.review : null;
	render(OrderPage, { data: { id: ID } } as never);
}

// The page renders a desktop and a phone layout; CSS (not loaded here) picks one.
const desktop = () => page.elementLocator(document.querySelector('.track-desktop') as HTMLElement);
const stepNow = (key: string) => t('track.step.' + key);

// Wide enough that the page's own CSS shows the desktop layout (the phone one is hidden).
beforeAll(() => page.viewport(1280, 900));

beforeEach(() => {
	h.queries = {};
	h.mutations = {};
	vi.mocked(openReceipt).mockClear();
});

describe('status variants', () => {
	test.each([
		['new', 'delivery', 'placed', 0],
		['accepted', 'delivery', 'confirmed', 1],
		['ready', 'delivery', 'ready', 2],
		['picked_up', 'delivery', 'on_the_way', 3],
		['picked_up', 'pickup', 'collected', 3],
		['delivered', 'delivery', 'delivered', 4]
	] as const)(
		'%s (%s) shows step %s as the current one',
		async (status, fulfillment, key, index) => {
			setup(
				{ status, ...(status === 'new' ? {} : { acceptedAt: NOW - 300_000 }) },
				{ fulfillment }
			);
			await expect.element(desktop().getByText(stepNow(key)).first()).toBeVisible();
			const steps = desktop()
				.getByRole('listitem')
				.elements()
				.filter((e) => e.classList.contains('ts-step'));
			expect(steps).toHaveLength(fulfillment === 'pickup' ? 4 : 5);
			const final = status === 'delivered' || (status === 'picked_up' && fulfillment === 'pickup');
			if (final) expect(steps.every((s) => s.classList.contains('done'))).toBe(true);
			else {
				expect(steps[index].getAttribute('aria-current')).toBe('step');
				expect(steps.slice(0, index).every((s) => s.classList.contains('done'))).toBe(true);
				expect(steps.slice(index + 1).every((s) => s.classList.contains('next'))).toBe(true);
			}
		}
	);

	test('a delivery the rider dropped off reads delivered, not on its way', async () => {
		setup({ status: 'picked_up', acceptedAt: NOW - 300_000, pickedUpAt: NOW - 120_000, deliveredAt: NOW - 60_000 });
		await expect.element(desktop().getByText(stepNow('delivered')).first()).toBeVisible();
		const steps = desktop()
			.getByRole('listitem')
			.elements()
			.filter((e) => e.classList.contains('ts-step'));
		expect(steps).toHaveLength(5);
		expect(steps.every((s) => s.classList.contains('done'))).toBe(true);
		expect(document.querySelector('.live-dot')).toBeNull();
	});

	test('a new order without an estimate says it is waiting for the restaurant', async () => {
		setup({ status: 'new' });
		await expect
			.element(desktop().getByRole('heading', { level: 1 }))
			.toHaveTextContent(t('track.waitingConfirm'));
	});

	test('a collected pickup is final: no live dot, reorder link shown', async () => {
		setup({ status: 'picked_up', acceptedAt: NOW - 1, pickedUpAt: NOW }, { fulfillment: 'pickup' });
		await expect.element(desktop().getByRole('link', { name: t('track.reorder') })).toBeVisible();
		expect(desktop().element().querySelector('.live-dot')).toBeNull();
	});

	test('a delivered order shows "Delivered at" the real time, no live dot, no minutes', async () => {
		const at = NOW - 120_000;
		setup({ status: 'delivered', acceptedAt: NOW - 1, pickedUpAt: NOW - 600_000, deliveredAt: at });
		const time = fmtTime(at, lang() === 'sv' ? 'sv-SE' : 'en-GB');
		await expect
			.element(desktop().getByRole('heading', { level: 1 }))
			.toHaveTextContent(t('track.deliveredAt', { t: time }));
		expect(desktop().element().querySelector('.live-dot')).toBeNull();
		expect(desktop().element().textContent).not.toMatch(/\b0 min/);
		await expect.element(desktop().getByRole('link', { name: t('track.reorder') })).toBeVisible();
	});

	test('rejected shows the rejected banner with the reason, not the stepper', async () => {
		setup({ status: 'rejected', rejectReason: 'too_busy' });
		await expect.element(desktop().getByText(t('track.cancelled'))).toBeVisible();
		await expect.element(desktop().getByText(m.order_rejected_body())).toBeVisible();
		await expect
			.element(
				desktop().getByText(
					t('track.cancelReason', {
						// the reason texts already start with "Reason:"; the banner must not repeat it
						reason: m.order_reason_too_busy().replace(/^(Reason|Orsak):\s*/i, '')
					})
				)
			)
			.toBeVisible();
		expect(desktop().element().querySelector('.ts')).toBeNull();
	});

	test('cancelled by the customer shows the cancelled banner without a reason line', async () => {
		setup({ status: 'cancelled' });
		await expect.element(desktop().getByText(m.order_cancelled_body())).toBeVisible();
		expect(desktop().element().textContent).not.toContain(
			t('track.cancelReason', { reason: '' }).trim()
		);
	});

	test.each(['requested', 'processing', 'succeeded', 'failed'])(
		'a cancelled order with a %s refund renders the refund timeline',
		async (status) => {
			setup(
				{ status: 'cancelled', refund: { status, amountCents: 25000 } },
				{ paymentStatus: 'refunded' }
			);
			const tl = desktop().getByTestId('refund-timeline');
			await expect.element(tl).toBeVisible();
			expect(tl.element().getAttribute('data-status')).toBe(status);
			expect(tl.element().querySelectorAll('li')).toHaveLength(3);
		}
	);

	test('a refund on a live order shows in the order card, not in a cancel banner', async () => {
		setup({
			status: 'accepted',
			acceptedAt: NOW - 1,
			refund: { status: 'processing', amountCents: 5000 }
		});
		await expect.element(desktop().getByTestId('refund-timeline')).toBeVisible();
		expect(desktop().element().querySelector('.cancel-banner')).toBeNull();
	});
});

test('a cancelled order is announced with a real status text, not a message key', async () => {
	setup({ status: 'cancelled' });
	const live = document.querySelector('.sr-only[aria-live]')!;
	expect(live.textContent).not.toContain('track.step.');
});

test('the receipt link opens the receipt for the order (generator stubbed)', async () => {
	setup({ status: 'picked_up', acceptedAt: NOW - 1 });
	await desktop()
		.getByRole('link', { name: t('track.receipt') })
		.click();
	expect(openReceipt).toHaveBeenCalledWith(ID);
});

describe('rating', () => {
	test('stars appear for a picked-up order without a review and submit the rating', async () => {
		setup({ status: 'picked_up', acceptedAt: NOW - 1 });
		const group = desktop().getByRole('group', { name: t('track.rate') });
		await expect.element(group).toBeVisible();
		await group.getByRole('button', { name: '4' }).click();
		expect(h.mutations['customer/reviews:submit']).toHaveBeenCalledWith({ orderId: ID, rating: 4 });
	});

	test('stars and the problem form are offered for a delivered order', async () => {
		setup({ status: 'delivered', acceptedAt: NOW - 1, deliveredAt: NOW });
		await expect.element(desktop().getByRole('group', { name: t('track.rate') })).toBeVisible();
		await expect.element(desktop().getByTestId('issue-form')).toBeVisible();
	});

	test('a delivery still at picked_up allows rating, shown after the order section', async () => {
		setup({ status: 'picked_up', acceptedAt: NOW - 1 }, { fulfillment: 'delivery' });
		const group = desktop().getByRole('group', { name: t('track.rate') });
		await expect.element(group).toBeVisible();
		expect(desktop().element().querySelector('.track-main .dv-stars')).toBeNull();
		expect(desktop().element().querySelector('.track-side .dv-stars')).not.toBeNull();
	});

	test('an existing review shows read-only stars', async () => {
		setup({ status: 'picked_up', acceptedAt: NOW - 1 }, { review: { rating: 5 } });
		const buttons = desktop()
			.getByRole('group', { name: t('track.rate') })
			.getByRole('button')
			.elements();
		expect(buttons).toHaveLength(5);
		expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
		expect(buttons.filter((b) => b.classList.contains('on'))).toHaveLength(5);
	});

	test('no rating prompt while the order is still in progress', async () => {
		setup({ status: 'accepted', acceptedAt: NOW - 1 });
		expect(desktop().element().querySelector('.dv-stars')).toBeNull();
	});
});

describe('report a problem', () => {
	const form = () => desktop().getByTestId('issue-form');

	test('only completed orders offer the form', async () => {
		setup({ status: 'accepted', acceptedAt: NOW - 1 });
		expect(desktop().element().querySelector('[data-testid=issue-form]')).toBeNull();
	});

	test('send is disabled until there is a message, then reports it with the category', async () => {
		setup({ status: 'picked_up', acceptedAt: NOW - 1 });
		const send = form().getByTestId('issue-send');
		await expect.element(send).toBeDisabled();
		await form().getByTestId('issue-category').selectOptions('late');
		await form().getByTestId('issue-message').fill('Arrived cold');
		await expect.element(send).toBeEnabled();
		await send.click();
		expect(h.mutations['issues:report']).toHaveBeenCalledWith({
			orderId: ID,
			category: 'late',
			message: 'Arrived cold'
		});
		await expect.element(form().getByTestId('issue-done')).toHaveTextContent(m.issue_sent());
	});

	test('a whitespace-only message cannot be sent', async () => {
		setup({ status: 'picked_up', acceptedAt: NOW - 1 });
		await form().getByTestId('issue-message').fill('   ');
		await expect.element(form().getByTestId('issue-send')).toBeDisabled();
	});

	test('the backend rate limit shows the already-reported state', async () => {
		h.mutations['issues:report'] = vi.fn(async () => {
			throw Object.assign(new Error('rate'), { data: { code: 'RATE_LIMITED' } });
		});
		setup({ status: 'picked_up', acceptedAt: NOW - 1 });
		await form().getByTestId('issue-message').fill('Again');
		await form().getByTestId('issue-send').click();
		await expect.element(form().getByTestId('issue-done')).toHaveTextContent(m.issue_already());
		expect(form().element().querySelector('[data-testid=issue-message]')).toBeNull();
	});

	test('any other failure shows an alert and keeps the form', async () => {
		h.mutations['issues:report'] = vi.fn(async () => {
			throw new Error('boom');
		});
		setup({ status: 'picked_up', acceptedAt: NOW - 1 });
		await form().getByTestId('issue-message').fill('Broken');
		await form().getByTestId('issue-send').click();
		await expect.element(form().getByRole('alert')).toHaveTextContent(m.issue_error());
		await expect.element(form().getByTestId('issue-message')).toBeVisible();
	});
});
