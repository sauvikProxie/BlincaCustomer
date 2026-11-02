import { describe, expect, it } from 'vitest';
import { refundSteps } from './refundTimeline';

const states = (s: string) => refundSteps(s).map((x) => x.state);

describe('refundSteps', () => {
	it('walks requested -> processing -> succeeded', () => {
		expect(states('requested')).toEqual(['current', 'todo', 'todo']);
		expect(states('processing')).toEqual(['done', 'current', 'todo']);
		expect(states('succeeded')).toEqual(['done', 'done', 'done']);
	});

	it('a failed refund ends in a failed last step', () => {
		expect(refundSteps('failed')).toEqual([
			{ key: 'requested', state: 'done' },
			{ key: 'processing', state: 'current' },
			{ key: 'failed', state: 'failed' }
		]);
	});
});
