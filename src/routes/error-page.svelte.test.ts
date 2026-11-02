/* +error.svelte: 404 variant (home link, no retry) vs the server-error variant
   (status label, Try again button) for 500 and other statuses. */
import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const state = vi.hoisted(() => ({ status: 500 }));
vi.mock('#app/state', () => ({
	page: {
		get status() {
			return state.status;
		},
		url: new URL('http://localhost/some/path')
	}
}));

import ErrorPage from './+error.svelte';
import { m } from '#lib/paraglide/messages.js';
import { t } from '#lib/stores/language.svelte.js';

describe('+error.svelte', () => {
	test.each([500, 502, 503])(
		'status %i shows the server-error variant with Try again',
		async (status) => {
			state.status = status;
			render(ErrorPage);
			await expect
				.element(page.getByRole('heading', { level: 1 }))
				.toHaveTextContent(m.servererror_heading());
			await expect.element(page.getByText(m.error_status_label({ status }))).toBeInTheDocument();
			await expect.element(page.getByText(m.servererror_body())).toBeInTheDocument();
			await expect.element(page.getByRole('button', { name: m.error_retry() })).toBeEnabled();
			await expect
				.element(page.getByRole('link', { name: t('nf.home') }))
				.toHaveAttribute('href', '/');
			expect(document.title).toContain(m.servererror_heading());
		}
	);

	test('status 404 shows the not-found variant without a retry button', async () => {
		state.status = 404;
		render(ErrorPage);
		await expect.element(page.getByText('404', { exact: true })).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent(t('nf.heading'));
		await expect
			.element(page.getByRole('link', { name: t('nf.home') }))
			.toHaveAttribute('href', '/');
		expect(page.getByRole('button', { name: m.error_retry() }).elements()).toHaveLength(0);
		expect(document.title).toContain(t('nf.title'));
	});
});
