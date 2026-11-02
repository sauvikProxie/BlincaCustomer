import { describe, expect, test } from 'vitest';
import { jsPDF } from 'jspdf';
import svMessages from '../../../messages/sv.json';
import enMessages from '../../../messages/en.json';
import {
	buildReceiptModel,
	createReceiptDoc,
	formatVatRate,
	receiptFileName,
	type ReceiptLabels,
	type ReceiptLocale
} from './receiptPdf.js';
import type { ReceiptData } from './receipt.js';

// download in sv and in en; check the file name, total, order number and
// label language. Labels below mirror messages/{sv,en}.json exactly — the
// key-set test underneath pins them to Paraglide.
const DATA: ReceiptData = {
	orderId: 'j97abc123def',
	orderNumber: '7',
	placedAt: new Date(2026, 9, 16, 18, 12).getTime(),
	fulfillment: 'delivery',
	restaurantName: 'Blinca Demo',
	restaurantAddress: 'Drottninggatan 1, 113 31 Stockholm',
	deliveryLines: ['Storgatan 5, 114 51 Stockholm'],
	items: [
		{
			name: 'Margherita',
			variant: 'Stor',
			qty: 2,
			unitCents: 11900,
			lineCents: 23800,
			options: [{ label: 'Sas: Bearnaise', qty: 1, cents: 1500 }]
		},
		{
			name: 'Latt Buffe',
			variant: null,
			qty: 1,
			unitCents: 2200,
			lineCents: 2200,
			options: []
		}
	],
	subtotalCents: 6278,
	deliveryFeeCents: 2900,
	discountCents: 1000,
	promoCode: 'HELG',
	totalCents: 8178,
	vat: [
		{ basisPoints: 1200, cents: 672 },
		{ basisPoints: 2500, cents: 440 }
	],
	paymentStatus: 'paid',
	paymentMethod: 'creditcard'
};

function labelsFrom(json: Record<string, string>): ReceiptLabels {
	const fill =
		(key: string) =>
		(vars: Record<string, string | number>): string => {
			let s: string = json[key] ?? '';
			for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
			return s;
		};
	return {
		title: json['receipt_title'] ?? '',
		orderNumber: (number) => fill('receipt_order_number')({ number }),
		date: json['receipt_date'] ?? '',
		delivered: json['receipt_delivered'] ?? '',
		subtotal: json['receipt_subtotal'] ?? '',
		deliveryFee: json['receipt_delivery_fee'] ?? '',
		discount: json['receipt_discount'] ?? '',
		discountWithCode: (code) => fill('receipt_discount_with_code')({ code }),
		vat: json['receipt_vat'] ?? '',
		vatRate: (rate, amount) => fill('nui_vat_rate')({ rate, amount }),
		total: json['receipt_total'] ?? '',
		paid: json['receipt_paid'] ?? '',
		paidWith: (method) =>
			method && json[`receipt_method_${method}`]
				? fill('receipt_paid_with')({ method: json[`receipt_method_${method}`] ?? '' })
				: (json['receipt_paid'] ?? ''),
		payment: json['receipt_payment'] ?? '',
		deliveryAddress: json['receipt_delivery_address'] ?? '',
		statusName: (status) => {
			if (status === 'paid') return json['nui_pay_paid'] ?? '';
			if (status === 'failed') return json['nui_pay_failed'] ?? '';
			if (status === 'expired') return json['nui_pay_expired'] ?? '';
			if (status === 'refunded') return json['nui_pay_refunded'] ?? '';
			return json['pay_pending'] ?? '';
		}
	};
}

function pdfText(doc: { output: (kind: string) => unknown }): string {
	const out = doc.output('arraybuffer') as ArrayBuffer;
	return Buffer.from(out).toString('latin1');
}

describe('receipt pdf', () => {
	test('VAT rates print without trailing zeros', () => {
		expect(formatVatRate(1200)).toBe('12');
		expect(formatVatRate(2500)).toBe('25');
		expect(formatVatRate(1250)).toBe('12,5');
	});

	test('file name follows the locale', () => {
		expect(receiptFileName('sv', '7')).toBe('kvitto-7.pdf');
		expect(receiptFileName('en', '7')).toBe('receipt-7.pdf');
	});

	test('sv + en message parity for every receipt label', () => {
		const sv = svMessages as Record<string, string>;
		const en = enMessages as Record<string, string>;
		const keys = [
			'receipt_title',
			'receipt_subtotal',
			'receipt_delivery_fee',
			'receipt_discount',
			'receipt_discount_with_code',
			'receipt_vat',
			'receipt_total',
			'receipt_paid',
			'receipt_order_number',
			'receipt_date',
			'receipt_delivery_address',
			'receipt_payment',
			'receipt_failed'
		];
		for (const key of keys) {
			expect(sv[key], `sv.${key}`).toBeTruthy();
			expect(en[key], `en.${key}`).toBeTruthy();
		}
		expect(sv['receipt_title']).toBe('Kvitto');
		expect(sv['receipt_subtotal']).toBe('Delsumma');
		expect(sv['receipt_delivery_fee']).toBe('Leveransavgift');
		expect(sv['receipt_discount']).toBe('Rabatt');
		expect(sv['receipt_vat']).toBe('Moms');
		expect(sv['receipt_total']).toBe('Totalt');
		expect(sv['receipt_paid']).toBe('Betald');
	});

	for (const locale of ['sv', 'en'] as ReceiptLocale[]) {
		test(`model + pdf in ${locale}: file name, total, order number, label language`, () => {
			const json = (locale === 'sv' ? svMessages : enMessages) as Record<string, string>;
			const model = buildReceiptModel(DATA, labelsFrom(json), locale);
			expect(model.fileName).toBe(locale === 'sv' ? 'kvitto-7.pdf' : 'receipt-7.pdf');
			expect(model.totalAmount).toBe('81,78 kr');
			expect(model.orderNumberLine).toContain('7');
			expect(model.discountLabel).toContain('HELG');
			const doc = createReceiptDoc(jsPDF, model);
			expect(doc.getNumberOfPages()).toBe(1);
			const text = pdfText(doc);
			expect(text.length).toBeGreaterThan(1000);
			for (const key of [
				'receipt_title',
				'receipt_subtotal',
				'receipt_delivery_fee',
				'receipt_vat',
				'receipt_total'
			] as const) {
				expect(text, `${locale}.${key}`).toContain(json[key]);
			}
			expect(text).toContain('81,78 kr');
			// Promo code on the discount line, the method, and the restaurant's full address.
			expect(text).toContain('HELG');
			expect(text).toContain(locale === 'sv' ? 'Betalt med kort' : 'Paid with card');
			expect(text).toContain('113 31 Stockholm');
			expect(text).toContain(model.orderNumberLine);
		});
	}

	test('the payment line: method per language, Swish, and nothing extra for an unknown method', () => {
		const line = (data: Partial<typeof DATA>, json: Record<string, string>) =>
			buildReceiptModel({ ...DATA, ...data }, labelsFrom(json), 'sv').paymentLine;
		const sv = svMessages as Record<string, string>;
		const en = enMessages as Record<string, string>;
		expect(line({ paymentMethod: 'creditcard' }, sv)).toBe('Betalt med kort');
		expect(line({ paymentMethod: 'creditcard' }, en)).toBe('Paid with card');
		expect(line({ paymentMethod: 'swish' }, sv)).toBe('Betalt med Swish');
		expect(line({ paymentMethod: 'applepay' }, en)).toBe('Paid with Apple Pay');
		expect(line({ paymentMethod: null }, sv)).toBe('Betald');
		expect(line({ paymentMethod: null }, en)).toBe('Paid');
		expect(line({ paymentStatus: 'refunded' as never, paymentMethod: 'swish' }, en)).not.toContain(
			'Swish'
		);
	});

	test('amounts keep the fixed two-decimal format with a promo', () => {
		const model = buildReceiptModel(DATA, labelsFrom(svMessages as Record<string, string>), 'sv');
		expect(model.discountAmount).toBe('-10,00 kr');
		expect(model.subtotalAmount).toMatch(/,\d{2} kr$/);
	});

	test('pickup without discount omits both lines', () => {
		const json = svMessages as Record<string, string>;
		const model = buildReceiptModel(
			{ ...DATA, fulfillment: 'pickup', deliveryLines: [], discountCents: 0, promoCode: null },
			labelsFrom(json),
			'sv'
		);
		expect(model.discountLabel).toBeNull();
		expect(model.discountAmount).toBeNull();
		expect(model.deliveryLines).toEqual([]);
	});
});

describe('delivered time on the receipt', () => {
	test('shown (sv + en) only when the order was delivered', () => {
		for (const [json, locale] of [
			[svMessages, 'sv'],
			[enMessages, 'en']
		] as const) {
			const labels = labelsFrom(json as Record<string, string>);
			const without = buildReceiptModel(DATA, labels, locale);
			expect(without.deliveredLine).toBeNull();
			const withTime = buildReceiptModel(
				{ ...DATA, deliveredAt: Date.UTC(2026, 5, 9, 18, 40) },
				labels,
				locale
			);
			expect(withTime.deliveredLine).toContain(labels.delivered);
			expect(withTime.deliveredLine).toMatch(/\d{2}[:.]\d{2}/);
		}
	});
});
