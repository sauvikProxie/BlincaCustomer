/* reset-password page with a stubbed Better Auth client (design-check has none):
   success, expired token and generic failure, each with its localized message. */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

vi.mock('#app/state', () => ({
	page: { url: new URL('http://localhost/reset-password?token=tok123') }
}));

import ResetPage from './(app)/reset-password/+page.svelte';
import { setAuthClient } from '#lib/stores/session.svelte.js';
import { m } from '#lib/paraglide/messages.js';

const resetPassword = vi.fn();
beforeEach(() => {
	resetPassword.mockReset().mockResolvedValue({ error: null });
	setAuthClient({ resetPassword });
});

async function submit(pass: string, again = pass) {
	await page.getByLabelText(m.reset_password(), { exact: true }).fill(pass);
	await page.getByLabelText(m.reset_confirm()).fill(again);
	await page.getByRole('button', { name: m.reset_submit() }).click();
}

describe('reset-password', () => {
	test('a short password is rejected before calling the backend', async () => {
		render(ResetPage);
		await submit('short');
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.reset_hint());
		expect(resetPassword).not.toHaveBeenCalled();
	});

	test('mismatching passwords are rejected before calling the backend', async () => {
		render(ResetPage);
		await submit('longenough1', 'longenough2');
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.reset_mismatch());
		expect(resetPassword).not.toHaveBeenCalled();
	});

	test('success sends the token and new password, then offers sign-in', async () => {
		render(ResetPage);
		await submit('longenough1');
		expect(resetPassword).toHaveBeenCalledWith({ newPassword: 'longenough1', token: 'tok123' });
		await expect.element(page.getByText(m.reset_done())).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.reset_to_login() }))
			.toHaveAttribute('href', '/login');
	});

	test('an invalid or expired token shows the invalid-link alert', async () => {
		resetPassword.mockResolvedValue({ error: { code: 'INVALID_TOKEN' } });
		render(ResetPage);
		await submit('longenough1');
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.reset_invalid());
	});

	test('any other failure shows the generic alert and keeps the form', async () => {
		resetPassword.mockResolvedValue({ error: { code: 'SERVER' } });
		render(ResetPage);
		await submit('longenough1');
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.reset_failed());
		await expect.element(page.getByRole('button', { name: m.reset_submit() })).toBeEnabled();
	});

	test('a missing auth client reports a failure instead of crashing', async () => {
		setAuthClient(null);
		render(ResetPage);
		await submit('longenough1');
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.reset_failed());
	});
});
