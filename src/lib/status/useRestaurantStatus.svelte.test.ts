import { afterEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { useRestaurantStatus } from '#lib/status/useRestaurantStatus.svelte.js';
import type { OpeningHours } from '@blinca/backend/stockholmTime';
import type { RestaurantStatusInput } from '#lib/types/status.js';

const mondayLunch: OpeningHours = {
	weekly: [{ dayOfWeek: 0, openMinutes: 660, closeMinutes: 840 }], // Mon 11:00–14:00
	specialDays: []
};
const noon = Date.parse('2026-10-05T10:00:00Z'); // 12:00 CEST, open
const close = Date.parse('2026-10-05T12:00:00Z'); // 14:00 CEST

function openInput(serverNow: number): RestaurantStatusInput {
	return {
		status: { kind: 'open', closesAt: close },
		serverNow,
		opensAt: null,
		closesAt: close,
		nextChangeAt: close,
		pausedUntil: null,
		hours: mondayLunch
	};
}

afterEach(() => {
	vi.useRealTimers();
});

describe('useRestaurantStatus', () => {
	test('flips open → closed when the clock passes closing time', () => {
		vi.useFakeTimers();
		vi.setSystemTime(noon);
		const input = openInput(noon);
		let view!: ReturnType<typeof useRestaurantStatus>;
		const dispose = $effect.root(() => {
			view = useRestaurantStatus(() => input);
		});
		flushSync();
		expect(view.status.kind).toBe('open');

		vi.advanceTimersByTime(close - noon + 1000);
		flushSync();
		expect(view.status.kind).toBe('closed');
		dispose();
	});

	test('corrects for client clock skew (client 5s ahead)', () => {
		vi.useFakeTimers();
		vi.setSystemTime(noon + 5000); // client clock is ahead of the server
		const input = openInput(noon);
		let view!: ReturnType<typeof useRestaurantStatus>;
		const dispose = $effect.root(() => {
			view = useRestaurantStatus(() => input);
		});
		flushSync();
		// Despite the +5s local skew, the corrected clock reads noon → still open.
		expect(view.status.kind).toBe('open');

		vi.advanceTimersByTime(close - noon + 1000);
		flushSync();
		expect(view.status.kind).toBe('closed');
		dispose();
	});

	test('clears its timer on destroy (no leak)', () => {
		vi.useFakeTimers();
		vi.setSystemTime(noon);
		const input = openInput(noon);
		const dispose = $effect.root(() => {
			useRestaurantStatus(() => input);
		});
		flushSync();
		expect(vi.getTimerCount()).toBeGreaterThan(0);
		dispose();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('re-syncs on visibilitychange when the clock jumped while hidden', () => {
		vi.useFakeTimers();
		vi.setSystemTime(noon);
		const input = openInput(noon);
		let view!: ReturnType<typeof useRestaurantStatus>;
		const dispose = $effect.root(() => {
			view = useRestaurantStatus(() => input);
		});
		flushSync();
		expect(view.status.kind).toBe('open');

		// Jump past closing WITHOUT running the scheduled timer (as a hidden tab does).
		vi.setSystemTime(close + 60_000);
		Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));
		flushSync();
		expect(view.status.kind).toBe('closed');
		dispose();
	});

	test('handles a DST spring-forward night', () => {
		vi.useFakeTimers();
		const dstNoon = Date.parse('2026-03-29T02:30:00Z'); // 04:30 CEST
		const dstClose = Date.parse('2026-03-29T03:00:00Z'); // 05:00 CEST
		vi.setSystemTime(dstNoon);
		const hours: OpeningHours = {
			weekly: [{ dayOfWeek: 6, openMinutes: 60, closeMinutes: 300 }], // Sun 01:00–05:00
			specialDays: []
		};
		const input: RestaurantStatusInput = {
			status: { kind: 'open', closesAt: dstClose },
			serverNow: dstNoon,
			opensAt: null,
			closesAt: dstClose,
			nextChangeAt: dstClose,
			pausedUntil: null,
			hours
		};
		let view!: ReturnType<typeof useRestaurantStatus>;
		const dispose = $effect.root(() => {
			view = useRestaurantStatus(() => input);
		});
		flushSync();
		expect(view.status.kind).toBe('open');

		vi.advanceTimersByTime(dstClose - dstNoon + 1000);
		flushSync();
		expect(view.status.kind).toBe('closed');
		dispose();
	});
});
