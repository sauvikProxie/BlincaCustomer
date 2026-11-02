import { describe, expect, test } from 'vitest';
import { easeProgress } from './ride.js';

describe('easeProgress', () => {
	test('eases forward without overshooting the target', () => {
		const at = easeProgress(0, 0.5, 16);
		expect(at).toBeGreaterThan(0);
		expect(at).toBeLessThan(0.5);
		expect(easeProgress(at, 0.5, 16)).toBeGreaterThan(at);
		expect(easeProgress(0, 0.5, 60_000)).toBeCloseTo(0.5, 10);
	});

	/* A frame timestamp can predate the ride start, and the target never
	   moves behind progress; neither may move the bike backward. */
	test('never moves backward', () => {
		expect(easeProgress(0.4, 0.4, 16)).toBe(0.4);
		expect(easeProgress(0.4, 0.2, 16)).toBe(0.4);
		expect(easeProgress(0.4, 0.5, 0)).toBe(0.4);
		expect(easeProgress(0.4, 0.5, -16)).toBe(0.4);
	});
});
