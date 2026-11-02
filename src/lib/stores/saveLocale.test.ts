import { describe, expect, it } from 'vitest';
import { raceTimeout, saveLocale } from './saveLocale.js';

describe('raceTimeout', () => {
	it('returns the value when it arrives in time', async () => {
		expect(await raceTimeout(Promise.resolve('ok'), 50, 'late')).toBe('ok');
	});
	it('gives up after the timeout, so the language switch is never held up', async () => {
		const started = Date.now();
		expect(await raceTimeout(new Promise<string>(() => {}), 40, 'late')).toBe('late');
		expect(Date.now() - started).toBeLessThan(400);
	});
	it('swallows a rejection', async () => {
		expect(await raceTimeout(Promise.reject(new Error('boom')), 50, 'failed')).toBe('failed');
	});
});

describe('saveLocale', () => {
	it('saves nothing for a signed-out visitor (no auth client, no request)', async () => {
		expect(await saveLocale('en')).toBe(false);
	});
});
