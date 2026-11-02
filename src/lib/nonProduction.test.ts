import { describe, expect, it } from 'vitest';
import { isNonProductionHost } from './nonProduction.js';

describe('isNonProductionHost', () => {
	it('flags staging, workers.dev and local hosts', () => {
		for (const host of [
			'staging.blinca.se',
			'partner-staging.blinca.se',
			'snart-staging.blinca.se',
			'blinca-customer.example.workers.dev',
			'localhost',
			'127.0.0.1'
		]) {
			expect(isNonProductionHost(host), host).toBe(true);
		}
	});

	it('leaves the production hosts alone', () => {
		for (const host of ['blinca.se', 'www.blinca.se', 'partner.blinca.se', 'snart.blinca.se', 'stagingfoo.se']) {
			expect(isNonProductionHost(host), host).toBe(false);
		}
	});
});
