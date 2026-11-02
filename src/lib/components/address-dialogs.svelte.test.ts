/* Address form (add + edit) and ConfirmDialog with the address store stubbed. */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const h = vi.hoisted(() => ({ add: vi.fn(), update: vi.fn(), toast: vi.fn() }));
vi.mock('$app/env/public', () => ({ PUBLIC_CONVEX_URL: 'http://127.0.0.1:1', PUBLIC_MAPBOX_ACCESS_TOKEN: '' }));
vi.mock('#lib/stores/address.svelte.js', () => ({ addAddress: h.add, updateAddress: h.update }));
vi.mock('#lib/layers.svelte.js', () => ({ toast: h.toast }));

import AddressFormContent from './AddressFormContent.svelte';
import ConfirmDialog from './ConfirmDialog.svelte';
import { t } from '#lib/stores/language.svelte.js';

const field = (key: string) => page.getByLabelText(t(key), { exact: true });
const save = () => page.getByRole('button', { name: t('addr.save') });

beforeEach(() => {
	h.add.mockReset().mockImplementation(async (d) => ({ id: 'new', ...d }));
	h.update.mockReset().mockImplementation(async (id, d) => ({ id, ...d }));
	h.toast.mockReset();
});

describe('AddressFormContent: add', () => {
	test('empty required fields are flagged and nothing is saved', async () => {
		const close = vi.fn();
		render(AddressFormContent, { close });
		await save().click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(t('form.fix'));
		for (const k of ['co.street', 'co.zip', 'co.city']) await expect.element(field(k)).toHaveAttribute('aria-invalid', 'true');
		expect(h.add).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();
	});

	test('saves trimmed values, defaults the label, closes, toasts and calls onSaved', async () => {
		const close = vi.fn();
		const onSaved = vi.fn();
		render(AddressFormContent, { close, onSaved });
		await field('co.street').fill('  Kungsgatan 1 ');
		await field('co.zip').fill('111 43');
		await field('co.city').fill('Stockholm ');
		await save().click();
		expect(h.add).toHaveBeenCalledWith(expect.objectContaining({ label: t('addr.other'), street: 'Kungsgatan 1', zip: '11143', city: 'Stockholm' }));
		expect(close).toHaveBeenCalled();
		expect(h.toast).toHaveBeenCalledWith(t('addr.saved'));
		expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
	});

	test('a postcode that is not five digits shows the zip error and saves nothing', async () => {
		const close = vi.fn();
		render(AddressFormContent, { close });
		await field('co.street').fill('Kungsgatan 1');
		await field('co.zip').fill('12 3');
		await field('co.city').fill('Stockholm');
		await save().click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(t('addr.zipBad'));
		await expect.element(field('co.zip')).toHaveAttribute('aria-invalid', 'true');
		expect(h.add).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();
	});

	test('a failing save shows an alert and keeps the dialog open for retry', async () => {
		h.add.mockRejectedValue(new Error('network'));
		const close = vi.fn();
		render(AddressFormContent, { close });
		await field('co.street').fill('Kungsgatan 1');
		await field('co.zip').fill('111 43');
		await field('co.city').fill('Stockholm');
		await save().click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(t('addr.saveFailed'));
		expect(close).not.toHaveBeenCalled();
		await expect.element(save()).toBeEnabled();
	});
});

describe('AddressFormContent: edit', () => {
	const row = { id: 'a1', label: 'Jobb', street: 'Lindholmspiren 5', zip: '417 56', city: 'Göteborg', extraEta: 15, lat: 1, lng: 2 };

	test('is prefilled and updates the row in place', async () => {
		const close = vi.fn();
		render(AddressFormContent, { close, address: row });
		await expect.element(field('co.street')).toHaveValue('Lindholmspiren 5');
		await expect.element(field('addr.label')).toHaveValue('Jobb');
		await field('co.street').fill('Hörnet 2');
		await save().click();
		expect(h.add).not.toHaveBeenCalled();
		expect(h.update).toHaveBeenCalledWith('a1', expect.objectContaining({ label: 'Jobb', street: 'Hörnet 2', extraEta: 15, lat: 1, lng: 2 }));
		expect(close).toHaveBeenCalled();
	});
});

describe('ConfirmDialog', () => {
	test('confirm closes the dialog and runs the action', async () => {
		const [close, onConfirm] = [vi.fn(), vi.fn()];
		render(ConfirmDialog, { title: 'Delete this address?', text: 'Gone.', ok: 'Delete', onConfirm, close });
		await expect.element(page.getByText('Delete this address?')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Delete' }).click();
		expect(close).toHaveBeenCalledTimes(1);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	test('cancel only closes', async () => {
		const [close, onConfirm] = [vi.fn(), vi.fn()];
		render(ConfirmDialog, { title: 'Delete?', text: '', ok: 'Delete', onConfirm, close });
		await page.getByRole('button', { name: t('common.cancel') }).click();
		expect(close).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	test('the safe (cancel) button takes focus so a stray Enter cannot confirm', async () => {
		render(ConfirmDialog, { title: 'x', text: '', ok: 'Delete', onConfirm: vi.fn(), close: vi.fn() });
		await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Cancel'));
	});
});
