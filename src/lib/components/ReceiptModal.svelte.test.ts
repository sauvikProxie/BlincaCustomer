/* ReceiptModal: the PDF button is present once the receipt loads and click runs
   the generator (stubbed: no real PDF is produced). */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const h = vi.hoisted(() => ({ load: vi.fn(), toast: vi.fn() }));
vi.mock('$app/env/public', () => ({ PUBLIC_CONVEX_URL: 'http://127.0.0.1:1', PUBLIC_MAPBOX_ACCESS_TOKEN: '' }));
vi.mock('#lib/order/receipt.js', () => ({ loadReceiptData: h.load }));
vi.mock('#lib/layers.svelte.js', () => ({ toastError: h.toast }));
// Spy mode keeps the real module (the modal uses its other exports) with every
// export a spy. A factory spreading importOriginal() crashes Vitest's browser
// mocker on Windows paths with spaces ("Blinca Backend").
vi.mock('#lib/order/receiptPdf.js', { spy: true });

import ReceiptModal from './ReceiptModal.svelte';
import { downloadReceiptPdf } from '#lib/order/receiptPdf.js';
import { m } from '#lib/paraglide/messages.js';

const download = vi.mocked(downloadReceiptPdf);

const DATA = {
	orderId: 'o1',
	orderNumber: '7',
	placedAt: new Date(2026, 9, 16, 18, 12).getTime(),
	fulfillment: 'delivery',
	restaurantName: 'Blinca Demo',
	restaurantAddress: 'Drottninggatan 1',
	deliveryLines: ['Storgatan 5, 114 51 Stockholm'],
	items: [{ name: 'Margherita', variant: null, qty: 1, unitCents: 11900, lineCents: 11900, options: [] }],
	subtotalCents: 11900,
	deliveryFeeCents: 2900,
	discountCents: 0,
	promoCode: null,
	totalCents: 14800,
	vat: [{ basisPoints: 1200, cents: 1586 }],
	paymentStatus: 'paid',
	paymentMethod: 'creditcard'
};
const button = () => page.getByRole('button', { name: m.nui_receipt_download() });

beforeEach(() => {
	h.load.mockReset().mockResolvedValue(DATA);
	download.mockReset().mockResolvedValue(true);
	h.toast.mockReset();
});

describe('ReceiptModal', () => {
	test('shows the receipt and a download button', async () => {
		render(ReceiptModal, { orderId: 'o1', close: vi.fn() });
		await expect.element(button()).toBeEnabled();
		await expect.element(page.getByText('Blinca Demo')).toBeInTheDocument();
		expect(h.load).toHaveBeenCalledWith('o1');
	});

	test('clicking download runs the PDF generator with the loaded data', async () => {
		render(ReceiptModal, { orderId: 'o1', close: vi.fn() });
		await button().click();
		expect(download).toHaveBeenCalledTimes(1);
		expect(download).toHaveBeenCalledWith(DATA);
		expect(h.toast).not.toHaveBeenCalled();
	});

	test('a failed generator reports it and re-enables the button', async () => {
		download.mockResolvedValue(false);
		render(ReceiptModal, { orderId: 'o1', close: vi.fn() });
		await button().click();
		expect(h.toast).toHaveBeenCalledWith(m.receipt_failed());
		await expect.element(button()).toBeEnabled();
	});

	test('a receipt that cannot be loaded toasts and closes the modal', async () => {
		h.load.mockResolvedValue(null);
		const close = vi.fn();
		render(ReceiptModal, { orderId: 'o1', close });
		await vi.waitFor(() => expect(close).toHaveBeenCalled());
		expect(h.toast).toHaveBeenCalledWith(m.receipt_failed());
	});
});
