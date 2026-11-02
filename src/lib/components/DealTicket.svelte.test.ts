/* A deal card has a code button only when the banner shows its code publicly. */
import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
vi.mock('#app/env', () => ({ browser: true, dev: false }));
vi.mock('#lib/stores/promo.svelte.js', () => ({ setPromoDraft: vi.fn() }));
vi.mock('#lib/stores/offers.svelte.js', () => ({
	markOpened: vi.fn(),
	flash: { key: '' },
	offerKey: (o: { id: string }) => o.id
}));
vi.mock('#lib/ui.js', () => ({ copyCode: vi.fn() }));

import DealTicket from './DealTicket.svelte';

const offer = (code: string | null) => ({
	id: 'b1',
	code,
	theme: 'red',
	image: null,
	rule: { type: 'info' },
	title: { en: 'Free delivery', sv: 'Fri leverans' },
	text: { en: 'Over 199 kr', sv: 'Över 199 kr' }
});
const props = (code: string | null) => ({ offer: offer(code), live: false, off: false, statusText: 'No end' });

describe('DealTicket', () => {
	test('shows the code and a copy button for a public code', async () => {
		render(DealTicket, props('HELG'));
		await expect.element(page.getByText('HELG')).toBeInTheDocument();
		await expect.element(page.getByRole('button')).toBeInTheDocument();
	});

	test('has no code and no button when the code is not public', async () => {
		render(DealTicket, props(null));
		await expect.element(page.getByText('Fri leverans').or(page.getByText('Free delivery'))).toBeInTheDocument();
		await expect.element(page.getByRole('button')).not.toBeInTheDocument();
	});
});
