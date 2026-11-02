/* Status components per order variant: TrackSteps (stepper), TrackPill (floating
   live pill) and RefundTimeline (requested / processing / succeeded / failed). */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const h = vi.hoisted(() => ({ path: '/' as string, orders: [] as unknown[] }));
vi.mock('$app/env/public', () => ({ PUBLIC_CONVEX_URL: 'http://127.0.0.1:1', PUBLIC_MAPBOX_ACCESS_TOKEN: '' }));
vi.mock('#app/state', () => ({ page: { url: { get pathname() { return h.path; } } } }));
vi.mock('#lib/stores/orders.svelte.js', () => ({ orders: () => h.orders }));

import TrackSteps from './TrackSteps.svelte';
import TrackPill from './track/TrackPill.svelte';
import RefundTimeline from './RefundTimeline.svelte';
import { setTimelineMap } from '#lib/stores/tracking.svelte.js';
import { clearSession, setSession } from '#lib/stores/session.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import { t } from '#lib/stores/language.svelte.js';

const KEYS = ['placed', 'confirmed', 'ready', 'on_the_way', 'delivered'];
const steps = KEYS.map((key) => ({ key, label: t('track.step.' + key), time: '' }));
const items = () => [...document.querySelectorAll<HTMLElement>('.ts-step')];

describe('TrackSteps', () => {
	test.each([
		['new', 0],
		['accepted', 1],
		['ready', 2],
		['picked_up', 3],
		['delivered', 4]
	])('%s: step %i is current, earlier done, later next', (_status, current) => {
		render(TrackSteps, { steps, current });
		const li = items();
		expect(li).toHaveLength(5);
		li.forEach((el, i) => {
			const state = i < current ? 'done' : i === current ? 'current' : 'next';
			expect(el.classList.contains(state), `step ${i} should be ${state}`).toBe(true);
			expect(el.getAttribute('aria-current')).toBe(i === current ? 'step' : null);
		});
		expect(document.querySelector('.ts')!.getAttribute('aria-label')).toBe(m.track_progress_label());
	});

	test('finished (delivered) marks every step done with no current step', () => {
		render(TrackSteps, { steps, current: 4, finished: true });
		expect(items().every((el) => el.classList.contains('done'))).toBe(true);
		expect(document.querySelector('[aria-current=step]')).toBeNull();
	});

	test('cancelled (index -1) has no current step and nothing done', () => {
		render(TrackSteps, { steps, current: -1 });
		expect(items().every((el) => el.classList.contains('next'))).toBe(true);
	});
});

describe('RefundTimeline', () => {
	const rows = () => [...document.querySelectorAll<HTMLElement>('.rt-step')];

	test.each([
		['requested', ['current', 'todo', 'todo']],
		['processing', ['done', 'current', 'todo']],
		['succeeded', ['done', 'done', 'done']],
		['failed', ['done', 'current', 'failed']]
	])('%s', (status, states) => {
		render(RefundTimeline, { refund: { status, amountCents: 12900 } });
		expect(document.querySelector('[data-testid=refund-timeline]')!.getAttribute('data-status')).toBe(status);
		expect(rows().map((r) => ['done', 'current', 'todo', 'failed'].find((s) => r.classList.contains(s)))).toEqual(states);
		expect(rows().filter((r) => r.getAttribute('aria-current') === 'step')).toHaveLength(status === 'succeeded' ? 0 : 1);
		expect(document.querySelector('.rt-title')!.textContent).toContain('129');
	});

	test('the failed refund ends in the failed label', () => {
		render(RefundTimeline, { refund: { status: 'failed', amountCents: 100 } });
		expect(rows().at(-1)!.textContent).toContain(m.order_refund_step_failed());
	});
});

describe('TrackPill', () => {
	const NOW = Date.now();
	const withOrder = (status: string, extra: Record<string, unknown> = {}) => {
		const o = { id: 'o1', slug: '', mode: 'delivery', status };
		h.orders = [o];
		setTimelineMap({ o1: { status, fulfillment: 'delivery', placedAt: NOW - 60_000, ...extra } });
	};
	beforeEach(() => {
		h.path = '/';
		setSession({ id: 'u1' }, null);
	});
	afterEach(() => {
		clearSession();
		setTimelineMap({});
		h.orders = [];
	});

	test.each([
		['new', 'placed'],
		['accepted', 'confirmed'],
		['ready', 'ready'],
		['picked_up', 'on_the_way']
	])('a %s order shows "%s" with a link to track it', async (status, key) => {
		withOrder(status);
		render(TrackPill);
		await expect.element(page.getByRole('status')).toHaveTextContent(t('track.step.' + key));
		await expect.element(page.getByRole('link', { name: t('track.track') })).toHaveAttribute('href', '/orders/o1');
	});

	test('a delivered order shows no pill (finished)', () => {
		withOrder('delivered');
		render(TrackPill);
		expect(document.querySelector('.pill')).toBeNull();
	});

	test.each(['rejected', 'cancelled'])('a %s order shows no pill', (status) => {
		withOrder(status);
		render(TrackPill);
		expect(document.querySelector('.pill')).toBeNull();
	});

	test('no pill on the order page itself or at checkout', () => {
		withOrder('accepted');
		for (const path of ['/orders/o1', '/checkout']) {
			h.path = path;
			const { unmount } = render(TrackPill);
			expect(document.querySelector('.pill'), path).toBeNull();
			unmount();
		}
	});

	test('the remaining minutes show while the estimate is ahead', async () => {
		withOrder('accepted', { estimatedReadyAt: NOW + 12 * 60_000 });
		render(TrackPill);
		await expect.element(page.getByRole('status')).toHaveTextContent(t('track.minutes', { n: 12 }));
	});
});
