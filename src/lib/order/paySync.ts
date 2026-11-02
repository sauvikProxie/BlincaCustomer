type Timer = ReturnType<typeof setInterval>;

export type PaySyncLoopOptions = {
	/** Re-fetches the payment from Mollie on the server. Errors are swallowed: getStatus is the source of truth. */
	sync: () => Promise<unknown>;
	/** False once the order has settled; the loop then stops by itself. */
	isPending: () => boolean;
	onTimeout: () => void;
	pollMs?: number;
	maxSeconds?: number;
	setIntervalFn?: (fn: () => void, ms: number) => Timer;
	clearIntervalFn?: (t: Timer) => void;
};

/**
 * One sync on start, then a bounded re-sync every `pollMs` until the order
 * settles or `maxSeconds` pass. `start()` while running is a no-op, so an
 * effect that re-runs can never stack a second loop, and nothing is called
 * until the caller decides there is a session (it simply does not call start).
 */
export function createPaySyncLoop(opts: PaySyncLoopOptions) {
	const {
		sync,
		isPending,
		onTimeout,
		pollMs = 5000,
		maxSeconds = 60,
		setIntervalFn = setInterval,
		clearIntervalFn = clearInterval
	} = opts;
	let timer: Timer | null = null;
	let inFlight = false;
	let seconds = 0;

	async function run() {
		if (inFlight) return;
		inFlight = true;
		try {
			await sync();
		} catch {
			// The live getStatus still reflects the real state; ignore sync blips.
		} finally {
			inFlight = false;
		}
	}

	function stop() {
		if (timer !== null) clearIntervalFn(timer);
		timer = null;
	}

	function start() {
		if (timer !== null) return;
		seconds = 0;
		void run();
		timer = setIntervalFn(() => {
			if (!isPending()) return stop();
			seconds += pollMs / 1000;
			if (seconds >= maxSeconds) {
				stop();
				onTimeout();
				return;
			}
			void run();
		}, pollMs);
	}

	return {
		start,
		stop,
		get running() {
			return timer !== null;
		}
	};
}
