import { describe, expect, test } from 'vitest';
import { issueFailure, issueMessageValid, MAX_ISSUE_MESSAGE } from './issueReport';

describe('issue report', () => {
	test('RATE_LIMITED means already reported, anything else is a plain error', () => {
		expect(issueFailure({ data: { code: 'RATE_LIMITED' } })).toBe('already');
		expect(issueFailure({ data: { code: 'INVALID_STATE' } })).toBe('error');
		expect(issueFailure(new Error('network'))).toBe('error');
	});

	test('message must be 1-500 characters after trimming', () => {
		expect(issueMessageValid('   ')).toBe(false);
		expect(issueMessageValid('a')).toBe(true);
		expect(issueMessageValid('a'.repeat(MAX_ISSUE_MESSAGE))).toBe(true);
		expect(issueMessageValid('a'.repeat(MAX_ISSUE_MESSAGE + 1))).toBe(false);
	});
});
