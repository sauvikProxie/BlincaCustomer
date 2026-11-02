import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaySyncLoop } from './paySync';

describe('createPaySyncLoop', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	const make = (pending = () => true) => {
		const sync = vi.fn().mockResolvedValue(undefined);
		const onTimeout = vi.fn();
		const loop = createPaySyncLoop({ sync, isPending: pending, onTimeout });
		return { sync, onTimeout, loop };
	};

	it('calls nothing until started (no session, no call)', async () => {
		const { sync } = make();
		await vi.advanceTimersByTimeAsync(120_000);
		expect(sync).not.toHaveBeenCalled();
	});

	it('syncs exactly once on start and ignores repeated start()', () => {
		const { sync, loop } = make();
		loop.start();
		loop.start();
		loop.start();
		expect(sync).toHaveBeenCalledTimes(1);
	});

	it('polls every 5 s and times out after 60 s, then stops', async () => {
		const { sync, onTimeout, loop } = make();
		loop.start();
		await vi.advanceTimersByTimeAsync(300_000);
		// 1 initial + polls at 5..55 s (11); the 60 s tick times out instead of syncing.
		expect(sync).toHaveBeenCalledTimes(12);
		expect(onTimeout).toHaveBeenCalledTimes(1);
		expect(loop.running).toBe(false);
	});

	it('stops polling once the order has settled', async () => {
		let pending = true;
		const { sync, onTimeout, loop } = make(() => pending);
		loop.start();
		await vi.advanceTimersByTimeAsync(5000);
		pending = false;
		await vi.advanceTimersByTimeAsync(60_000);
		expect(sync).toHaveBeenCalledTimes(2);
		expect(onTimeout).not.toHaveBeenCalled();
		expect(loop.running).toBe(false);
	});

	it('survives a failing sync and does not overlap calls', async () => {
		let release!: () => void;
		const sync = vi
			.fn()
			.mockImplementationOnce(
				() => new Promise<void>((_, rej) => (release = () => rej(new Error('boom'))))
			)
			.mockResolvedValue(undefined);
		const loop = createPaySyncLoop({ sync, isPending: () => true, onTimeout: vi.fn() });
		loop.start();
		await vi.advanceTimersByTimeAsync(5000); // first call still in flight: tick skipped
		expect(sync).toHaveBeenCalledTimes(1);
		release();
		await vi.advanceTimersByTimeAsync(5000);
		expect(sync).toHaveBeenCalledTimes(2);
		loop.stop();
	});

	it('can be restarted after stop (check again)', async () => {
		const { sync, loop } = make();
		loop.start();
		await vi.advanceTimersByTimeAsync(0); // let the first call settle
		loop.stop();
		loop.start();
		expect(sync).toHaveBeenCalledTimes(2);
		loop.stop();
	});
});
