/*
 * Live-clock lifecycle. The real-mode ticker used to run forever after the
 * first track() render; it must now tick only while something is subscribed
 * and be cleared the moment the last subscriber goes away.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clock, subscribeClock } from './tracking.svelte.js';

describe('subscribeClock', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	test('ticks while subscribed, keeps ticking with one left, stops on the last unsubscribe', async () => {
		const un1 = subscribeClock();
		const un2 = subscribeClock();

		await vi.advanceTimersByTimeAsync(1100);
		const t1 = clock.now;
		expect(t1).toBeGreaterThan(0);
		await vi.advanceTimersByTimeAsync(1100);
		expect(clock.now).toBeGreaterThan(t1);

		un1();
		const t2 = clock.now;
		await vi.advanceTimersByTimeAsync(1100);
		expect(clock.now).toBeGreaterThan(t2);

		un2();
		const t3 = clock.now;
		await vi.advanceTimersByTimeAsync(3100);
		expect(clock.now).toBe(t3);
	});

	test('a new subscription restarts the clock after it was cleared', async () => {
		const un = subscribeClock();
		un();
		const stopped = clock.now;
		await vi.advanceTimersByTimeAsync(2100);
		expect(clock.now).toBe(stopped);

		const un2 = subscribeClock();
		await vi.advanceTimersByTimeAsync(1100);
		expect(clock.now).toBeGreaterThan(stopped);
		un2();
	});
});
