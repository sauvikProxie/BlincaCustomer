/**
 * Receipt PDF builder (jsPDF).
 *
 * jsPDF is NEVER statically imported here: the browser entry
 * (`downloadReceiptPdf`) loads it with `await import('jspdf')` inside the
 * click handler, so it never runs in SSR and never lands in the server
 * bundle. The pure parts (amounts, filename, model, doc layout) take the
 * constructor / labels as parameters, which keeps them unit-testable.
 *
 * Language: labels resolve through Paraglide at press time (`getLocale()`),
 * dates use sv-SE / en-GB, amounts are ALWAYS Swedish ("62,78 kr"), and the
 * file is kvitto-{n}.pdf / receipt-{n}.pdf. Only WinAnsi-safe glyphs are
 * printed (no U+2212 minus, no ≈) so desktop Chrome/Firefox/Safari render
 * every line; iOS opens the blob in a new tab (direct download is blocked).
 */
import type { jsPDF as JsPdf } from 'jspdf';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { formatMoney } from '#lib/money.js';
import type { ReceiptData, ReceiptPaymentState } from './receipt.js';

export type JsPdfCtor = typeof JsPdf;
export type ReceiptLocale = 'sv' | 'en';

export function currentReceiptLocale(): ReceiptLocale {
	return getLocale() === 'en' ? 'en' : 'sv';
}

/** Receipts always show two decimals, like the partner/admin sheets. */
const formatSek = (cents: number): string => formatMoney(cents, { fixed: true });

/** VAT basis points → "12" / "12,5" (no trailing zeros). */
export function formatVatRate(basisPoints: number): string {
	return (basisPoints / 100).toFixed(2).replace('.', ',').replace(/,?0+$/, '');
}

export function receiptFileName(locale: ReceiptLocale, orderNumber: string | number): string {
	return `${locale === 'sv' ? 'kvitto' : 'receipt'}-${orderNumber}.pdf`;
}

export type ReceiptLabels = {
	title: string;
	orderNumber: (number: string | number) => string;
	date: string;
	delivered: string;
	subtotal: string;
	deliveryFee: string;
	discount: string;
	discountWithCode: (code: string) => string;
	vat: string;
	vatRate: (rate: string, amount: string) => string;
	total: string;
	paid: string;
	/** "Paid with card"; just "Paid" when the method is unknown. */
	paidWith: (method: string | null) => string;
	payment: string;
	deliveryAddress: string;
	statusName: (status: ReceiptPaymentState) => string;
};

const METHOD_NAMES: Record<string, () => string> = {
	creditcard: m.receipt_method_creditcard,
	applepay: m.receipt_method_applepay,
	swish: m.receipt_method_swish,
	klarna: m.receipt_method_klarna,
	paypal: m.receipt_method_paypal,
	banktransfer: m.receipt_method_banktransfer,
	directdebit: m.receipt_method_directdebit,
	ideal: m.receipt_method_ideal,
	bancontact: m.receipt_method_bancontact,
	twint: m.receipt_method_twint,
	giftcard: m.receipt_method_giftcard
};

/** Every label through Paraglide (sv + en), resolved at press time. */
export function resolveReceiptLabels(): ReceiptLabels {
	return {
		title: m.receipt_title(),
		orderNumber: (number) => m.receipt_order_number({ number }),
		date: m.receipt_date(),
		delivered: m.receipt_delivered(),
		subtotal: m.receipt_subtotal(),
		deliveryFee: m.receipt_delivery_fee(),
		discount: m.receipt_discount(),
		discountWithCode: (code) => m.receipt_discount_with_code({ code }),
		vat: m.receipt_vat(),
		vatRate: (rate, amount) => m.nui_vat_rate({ rate, amount }),
		total: m.receipt_total(),
		paid: m.receipt_paid(),
		paidWith: (method) => {
			const name = method ? METHOD_NAMES[method]?.() : undefined;
			return name ? m.receipt_paid_with({ method: name }) : m.receipt_paid();
		},
		payment: m.receipt_payment(),
		deliveryAddress: m.receipt_delivery_address(),
		statusName: (status) => {
			if (status === 'paid') return m.nui_pay_paid();
			if (status === 'failed') return m.nui_pay_failed();
			if (status === 'expired') return m.nui_pay_expired();
			if (status === 'refunded') return m.nui_pay_refunded();
			return m.pay_pending();
		}
	};
}

export type ReceiptModelLine = {
	title: string;
	details: string[];
	amount: string;
};

export type ReceiptModel = {
	title: string;
	orderNumberLine: string;
	dateLine: string;
	/** Set only for an order that was delivered. */
	deliveredLine: string | null;
	restaurantName: string;
	restaurantAddress: string;
	deliveryTitle: string;
	deliveryLines: string[];
	itemLines: ReceiptModelLine[];
	subtotalLabel: string;
	subtotalAmount: string;
	deliveryFeeLabel: string;
	deliveryFeeAmount: string;
	discountLabel: string | null;
	discountAmount: string | null;
	vatTitle: string;
	vatLines: string[];
	totalLabel: string;
	totalAmount: string;
	paymentTitle: string;
	paymentLine: string;
	fileName: string;
};

function formatReceiptDate(placedAt: number, locale: ReceiptLocale): string {
	const tag = locale === 'sv' ? 'sv-SE' : 'en-GB';
	const d = new Date(placedAt);
	const date = d.toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric' });
	const time = d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
	return `${date} ${time}`;
}

export function buildReceiptModel(
	data: ReceiptData,
	labels: ReceiptLabels,
	locale: ReceiptLocale
): ReceiptModel {
	const paidLabel =
		data.paymentStatus === 'paid'
			? labels.paidWith(data.paymentMethod)
			: labels.statusName(data.paymentStatus);
	return {
		title: labels.title,
		orderNumberLine: labels.orderNumber(data.orderNumber),
		dateLine: `${labels.date}: ${formatReceiptDate(data.placedAt, locale)}`,
		deliveredLine:
			data.deliveredAt !== undefined
				? `${labels.delivered}: ${formatReceiptDate(data.deliveredAt, locale)}`
				: null,
		restaurantName: data.restaurantName,
		restaurantAddress: data.restaurantAddress,
		deliveryTitle: labels.deliveryAddress,
		deliveryLines: data.deliveryLines,
		itemLines: data.items.map((line) => ({
			title: `${line.qty} × ${line.name}`,
			details: [
				...(line.variant ? [line.variant] : []),
				...line.options.map((o) =>
					o.cents
						? `+ ${o.label} × ${o.qty} (${formatSek(o.cents * o.qty)})`
						: `+ ${o.label} × ${o.qty}`
				)
			],
			amount: formatSek(line.lineCents)
		})),
		subtotalLabel: labels.subtotal,
		subtotalAmount: formatSek(data.subtotalCents),
		deliveryFeeLabel: labels.deliveryFee,
		deliveryFeeAmount: formatSek(data.deliveryFeeCents),
		discountLabel:
			data.discountCents > 0
				? data.promoCode
					? labels.discountWithCode(data.promoCode)
					: labels.discount
				: null,
		discountAmount: data.discountCents > 0 ? `-${formatSek(data.discountCents)}` : null,
		vatTitle: labels.vat,
		vatLines: data.vat.map((v) => labels.vatRate(formatVatRate(v.basisPoints), formatSek(v.cents))),
		totalLabel: labels.total,
		totalAmount: formatSek(data.totalCents),
		paymentTitle: labels.payment,
		paymentLine: paidLabel,
		fileName: receiptFileName(locale, data.orderNumber)
	};
}

const PAGE_W = 210;
const MARGIN = 16;
const RIGHT = PAGE_W - MARGIN;
const BOTTOM = 282;

type Doc = InstanceType<JsPdfCtor>;

/** Lay the resolved model out on A4. Pure given the constructor. */
export function createReceiptDoc(JsPdfCtor: JsPdfCtor, model: ReceiptModel): Doc {
	const doc = new JsPdfCtor({ unit: 'mm', format: 'a4' });
	let y = 20;

	const need = (h: number) => {
		if (y + h > BOTTOM) {
			doc.addPage();
			y = 20;
		}
	};
	const text = (str: string, x: number, size = 10, bold = false) => {
		doc.setFont('helvetica', bold ? 'bold' : 'normal');
		doc.setFontSize(size);
		doc.text(str, x, y);
	};
	const right = (str: string, size = 10, bold = false) => {
		doc.setFont('helvetica', bold ? 'bold' : 'normal');
		doc.setFontSize(size);
		doc.text(str, RIGHT, y, { align: 'right' });
	};
	const wrapped = (str: string, x: number, maxW: number, size = 10, bold = false): number => {
		const lines = doc.splitTextToSize(str, maxW) as string[];
		for (const line of lines) {
			need(6);
			text(line, x, size, bold);
			y += 5;
		}
		return lines.length;
	};
	const row = (label: string, amount: string, size = 10, bold = false) => {
		need(7);
		text(label, MARGIN, size, bold);
		right(amount, size, bold);
		y += 6;
	};
	const gap = (h = 4) => {
		y += h;
	};

	text(model.title, MARGIN, 17, true);
	y += 8;
	text(model.orderNumberLine, MARGIN, 10);
	y += 6;
	text(model.dateLine, MARGIN, 10);
	y += 6;
	if (model.deliveredLine) {
		text(model.deliveredLine, MARGIN, 10);
		y += 6;
	}
	gap(2);
	wrapped(model.restaurantName, MARGIN, RIGHT - MARGIN, 11, true);
	if (model.restaurantAddress) wrapped(model.restaurantAddress, MARGIN, RIGHT - MARGIN);
	if (model.deliveryLines.length) {
		gap(2);
		text(model.deliveryTitle, MARGIN, 10, true);
		y += 6;
		for (const line of model.deliveryLines) wrapped(line, MARGIN, RIGHT - MARGIN);
	}
	gap(4);
	for (const line of model.itemLines) {
		need(7);
		const parts = doc.splitTextToSize(line.title, RIGHT - MARGIN - 34) as string[];
		text(parts[0] ?? '', MARGIN, 10, true);
		right(line.amount, 10, true);
		y += 6;
		for (const extra of parts.slice(1)) {
			need(6);
			text(extra, MARGIN, 10, true);
			y += 5;
		}
		for (const detail of line.details) {
			need(6);
			text(detail, MARGIN + 5, 9);
			y += 5;
		}
	}
	gap(2);
	row(model.subtotalLabel, model.subtotalAmount);
	row(model.deliveryFeeLabel, model.deliveryFeeAmount);
	if (model.discountLabel && model.discountAmount) row(model.discountLabel, model.discountAmount);
	if (model.vatLines.length) {
		need(7);
		text(model.vatTitle, MARGIN, 10, true);
		y += 6;
		for (const line of model.vatLines) {
			need(6);
			text(line, MARGIN + 5, 9);
			y += 5;
		}
	}
	gap(2);
	row(model.totalLabel, model.totalAmount, 13, true);
	gap(3);
	text(model.paymentTitle, MARGIN, 10, true);
	y += 6;
	text(model.paymentLine, MARGIN, 10);
	y += 6;
	return doc;
}

function isIOS(): boolean {
	try {
		const nav = window.navigator;
		if (/iPad|iPhone|iPod/.test(nav.userAgent)) return true;
		return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
	} catch {
		return false;
	}
}

/**
 * Build + deliver the PDF. jsPDF loads here (never in SSR), the file saves
 * on desktop Chrome/Firefox/Safari and opens in a new tab on iOS.
 */
export async function downloadReceiptPdf(data: ReceiptData): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	try {
		const locale = currentReceiptLocale();
		const model = buildReceiptModel(data, resolveReceiptLabels(), locale);
		const { jsPDF } = await import('jspdf');
		const doc = createReceiptDoc(jsPDF, model);
		if (isIOS()) {
			const url = String(doc.output('bloburl'));
			const opened = window.open(url, '_blank');
			if (!opened) doc.save(model.fileName);
		} else {
			doc.save(model.fileName);
		}
		return true;
	} catch (e) {
		console.warn('[receipt] pdf failed', e);
		return false;
	}
}
