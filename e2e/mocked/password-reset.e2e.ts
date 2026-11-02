import { expect, test } from '@playwright/test';
import { open, tr } from './support';

test('/forgot-password redirects to the login page', async ({ page }) => {
	await open(page, '/forgot-password');
	await expect(page).toHaveURL(/\/login$/);
});

test('forgot password without a valid email asks for one, as an alert on the field', async ({
	page
}, info) => {
	await open(page, '/login');
	await page.getByRole('button', { name: tr(info, 'login.forgot') }).click();
	await expect(page.getByRole('alert')).toHaveText(tr(info, 'login.forgotNeedEmail'));
	const email = page.getByLabel(tr(info, 'contact.email'));
	await expect(email).toHaveAttribute('aria-invalid', 'true');
	await expect(email).toBeFocused();
});

test('forgot password with a valid email confirms with a toast', async ({ page }, info) => {
	await open(page, '/login');
	await page.getByLabel(tr(info, 'contact.email')).fill('anna@example.se');
	await page.getByRole('button', { name: tr(info, 'login.forgot') }).click();
	await expect(
		page.getByRole('status').filter({ hasText: tr(info, 'login.resetSent') })
	).toBeVisible();
});

test.describe('reset-password page', () => {
	test('a short password is rejected with a localized alert', async ({ page }, info) => {
		await open(page, '/reset-password?token=abc');
		await page.getByLabel(tr(info, 'reset_password'), { exact: true }).fill('short');
		await page.getByLabel(tr(info, 'reset_confirm')).fill('short');
		await page.getByRole('button', { name: tr(info, 'reset_submit') }).click();
		await expect(page.getByRole('alert')).toHaveText(tr(info, 'reset_hint'));
	});

	test('mismatching passwords are rejected with a localized alert', async ({ page }, info) => {
		await open(page, '/reset-password?token=abc');
		await page.getByLabel(tr(info, 'reset_password'), { exact: true }).fill('longenough1');
		await page.getByLabel(tr(info, 'reset_confirm')).fill('longenough2');
		await page.getByRole('button', { name: tr(info, 'reset_submit') }).click();
		await expect(page.getByRole('alert')).toHaveText(tr(info, 'reset_mismatch'));
	});

	test('a missing or errored token shows the invalid-link message and a way back', async ({
		page
	}, info) => {
		await open(page, '/reset-password?error=INVALID_TOKEN');
		await expect(page.getByText(tr(info, 'reset_invalid'))).toBeVisible();
		await expect(page.getByRole('link', { name: tr(info, 'reset_to_login') })).toHaveAttribute(
			'href',
			'/login'
		);
		await expect(page.getByLabel(tr(info, 'reset_password'), { exact: true })).toHaveCount(0);
	});

	// reset-password/+page.svelte renders the invalid-link message as a plain
	// <p class="form-err"> (no role="alert"), so assistive tech is not told.
	test('the invalid-link message is announced as an alert', async ({ page }, info) => {
		await open(page, '/reset-password');
		await expect(page.getByRole('alert')).toHaveText(tr(info, 'reset_invalid'));
	});
});
