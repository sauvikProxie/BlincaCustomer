/**
 * Receipt data loader — real order + payment reads for the receipt modal/PDF.
 *
 * Design-check: maps the sample order from the orders engine (catalog prices).
 * Real mode: `customer.orders.getMine` (items, variant/options, quantities,
 * line totals, subtotal, delivery fee, discount, VAT breakdown, dailyNumber,
 * restaurant, date, delivery address) + `customer.payments.getStatus`
 * (status). The payment method comes from `getMine` ("unknown" on older
 * orders shows nothing), never invented card digits.
 *
 * No price maths on real data: every total comes from the backend. Amounts
 * stay in integer öre until the PDF/model layer formats them (always Swedish
 * "62,78 kr", regardless of UI language).
 */
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@blinca/backend/convex/_generated/api';
import type { Id } from '@blinca/backend/convex/_generated/dataModel';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { getLocale } from '#lib/paraglide/runtime.js';
import { formatPostcode, addressLine as restaurantAddressLine } from '#lib/postcode.js';
import { isDesignCheck, sessionCache } from '#lib/stores/session.svelte.js';
import { orders } from '#lib/stores/orders.svelte.js';
import { restaurant, item, getSiteData } from '#lib/stores/catalog.svelte.js';
import { address } from '#lib/stores/address.svelte.js';
import { L } from '#lib/format.js';
import type { MyOrder, PaymentStatus } from '#lib/services/catalog.js';

export type ReceiptPaymentState = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export type ReceiptOptionData = {
	label: string;
	qty: number;
	cents: number;
};

export type ReceiptItemData = {
	name: string;
	variant: string | null;
	qty: number;
	unitCents: number;
	lineCents: number;
	options: ReceiptOptionData[];
};

export type ReceiptVatData = {
	basisPoints: number;
	cents: number;
};

export type ReceiptData = {
	orderId: string;
	/** Daily counter number; falls back to the id tail before payment. */
	orderNumber: string;
	placedAt: number;
	/** Delivery orders: when it was delivered (from getTimeline, `getMine` does not project it). */
	deliveredAt?: number;
	fulfillment: 'delivery' | 'pickup';
	restaurantName: string;
	restaurantAddress: string;
	/** Empty for pickup. */
	deliveryLines: string[];
	items: ReceiptItemData[];
	subtotalCents: number;
	deliveryFeeCents: number;
	discountCents: number;
	promoCode: string | null;
	totalCents: number;
	vat: ReceiptVatData[];
	paymentStatus: ReceiptPaymentState;
	/** Mollie method id (creditcard, swish, ...); null when unknown. */
	paymentMethod: string | null;
};

function locale(): 'sv' | 'en' {
	return getLocale() === 'en' ? 'en' : 'sv';
}

function optionLabel(
	group: string,
	groupEn: string | undefined,
	name: string,
	nameEn: string | undefined
): string {
	const lang = locale();
	const g = lang === 'en' ? groupEn || group : group;
	const n = lang === 'en' ? nameEn || name : name;
	return g ? `${g}: ${n}` : n;
}

/** VAT contained in a VAT-inclusive gross amount (backend `lineVatCents`). */
function vatContained(grossCents: number, basisPoints: number): number {
	return Math.round((grossCents * basisPoints) / (10000 + basisPoints));
}

/**
 * Load the receipt for one order. Returns null when the order cannot be
 * read (unknown id, signed out, or the backend call fails).
 */
export async function loadReceiptData(orderId: string): Promise<ReceiptData | null> {
	if (isDesignCheck()) return designReceipt(orderId);
	return realReceipt(orderId);
}

/** Sample-data receipt: the transplanted order shape + catalog prices. */
function designReceipt(orderId: string): ReceiptData | null {
	const lang = locale();
	const order = orders().find((o) => o && o.id === orderId);
	if (!order) return null;
	const rest = restaurant(order.slug);
	const items: ReceiptItemData[] = (order.items || []).map((line) => {
		const dish = item(order.slug, line.itemId);
		const name = dish ? L(dish.name, lang) : String(line.itemId);
		const options: ReceiptOptionData[] = [];
		if (dish) {
			for (const group of dish.options || []) {
				const chosen: string[] = ((line.opts || {})[group.id] || []).slice().sort();
				for (const choiceId of chosen) {
					const choice = (group.choices || []).find((c) => c.id === choiceId);
					if (!choice) continue;
					options.push({
						label: `${L(group.name, lang)}: ${L(choice.name, lang)}`,
						qty: 1,
						cents: Math.round((choice.price || 0) * 100)
					});
				}
			}
		}
		const unitKr = dish ? dish.price || 0 : 0;
		const unitCents = Math.round(unitKr * 100);
		const optionCents = options.reduce((sum, o) => sum + o.cents * o.qty, 0);
		const lineCents = (unitCents + optionCents) * Math.max(1, line.qty || 1);
		return {
			name,
			variant: null,
			qty: line.qty || 1,
			unitCents,
			lineCents,
			options
		};
	});
	const subtotalCents = items.reduce((sum, l) => sum + l.lineCents, 0);
	const totalCents = Math.round((order.total ?? order.amount ?? 0) * 100);
	// The transplanted sample shape carries an optional discount (see the
	// tracking page's `order.discount`); the static Order type omits it.
	const discountCents = Math.round(((order as { discount?: number }).discount ?? 0) * 100);
	const deliveryFeeCents = Math.max(0, totalCents - subtotalCents + discountCents);
	const rate = getSiteData().vatRate ?? 0.12;
	const basisPoints = Math.round(rate * 10000);
	const a = address();
	return {
		orderId: String(order.id),
		orderNumber: String(order.id),
		placedAt: new Date(order.date).getTime() || Date.now(),
		fulfillment: order.mode === 'pickup' ? 'pickup' : 'delivery',
		restaurantName: rest ? rest.name : '',
		restaurantAddress: rest ? restaurantAddressLine(rest.address, rest.postalCode, rest.city) : '',
		deliveryLines:
			order.mode === 'pickup' || !a
				? []
				: [`${a.street}, ${a.zip} ${a.city}`.trim()].filter(Boolean),
		items,
		subtotalCents,
		deliveryFeeCents,
		discountCents,
		promoCode: null,
		totalCents,
		vat: [{ basisPoints, cents: vatContained(subtotalCents, basisPoints) }],
		paymentStatus: 'paid',
		paymentMethod: 'creditcard'
	};
}

async function authHttp(): Promise<ConvexHttpClient | null> {
	const client = sessionCache.authClient;
	let token: string | null = null;
	try {
		const res = await client?.convex?.token({ fetchOptions: { throw: false } });
		token = res?.data?.token ?? null;
	} catch {
		// No token (signed out / offline) — handled below.
	}
	if (!token) return null;
	const http = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	http.setAuth(token);
	return http;
}

/** Real receipt: `getMine` + `getStatus`, no client-side totals. */
async function realReceipt(orderId: string): Promise<ReceiptData | null> {
	const lang = locale();
	const http = await authHttp();
	if (!http) return null;
	const id = orderId as Id<'orders'>;
	let order: MyOrder;
	let status: PaymentStatus;
	let deliveredAt: number | undefined;
	try {
		[order, status, deliveredAt] = await Promise.all([
			http.query(api.customer.orders.getMine, { orderId: id }),
			http.query(api.customer.payments.getStatus, { orderId: id }),
			// Only the delivered time: a failed timeline read must not block the receipt.
			http
				.query(api.customer.orderTracking.getTimeline, { orderId: id })
				.then((tl) => tl?.deliveredAt ?? undefined)
				.catch(() => undefined)
		]);
	} catch {
		return null;
	}
	if (!order) return null;
	const slug = order.restaurant?.slug ?? '';
	const rest = slug ? restaurant(slug) : null;
	const items: ReceiptItemData[] = (order.items || []).map((line) => ({
		name: lang === 'en' ? line.nameEn || line.name : line.name,
		variant: (lang === 'en' ? line.variantNameEn || line.variantName : line.variantName) || null,
		qty: line.quantity,
		unitCents: line.unitPriceCents,
		lineCents: line.lineTotalCents,
		options: (line.options || []).map((o) => {
			const raw = o as typeof o & { groupNameEn?: string; optionNameEn?: string };
			return {
				label: optionLabel(o.groupName, raw.groupNameEn, o.optionName, raw.optionNameEn),
				qty: o.quantity,
				cents: o.priceCents
			};
		})
	}));
	const addr = order.deliveryAddress;
	return {
		orderId: String(order.orderId),
		orderNumber: String(
			status?.dailyNumber ?? order.dailyNumber ?? String(order.orderId).slice(-6)
		),
		placedAt: order.placedAt,
		...(deliveredAt !== undefined ? { deliveredAt } : {}),
		fulfillment: order.fulfillment === 'pickup' ? 'pickup' : 'delivery',
		restaurantName: order.restaurant?.name ?? '',
		restaurantAddress: restaurantAddressLine(
			order.restaurant?.address ?? rest?.address,
			order.restaurant?.postalCode ?? rest?.postalCode,
			order.restaurant?.city ?? rest?.city
		),
		deliveryLines:
			order.fulfillment === 'delivery' && addr
				? [`${addr.street}, ${formatPostcode(addr.postalCode)} ${addr.city}`.trim()].filter(Boolean)
				: [],
		items,
		subtotalCents: order.subtotalCents,
		deliveryFeeCents: order.deliveryFeeCents,
		discountCents: order.discountCents,
		promoCode: order.promoCode ?? null,
		totalCents: order.totalCents,
		vat: (order.vatBreakdown || []).map((v) => ({ basisPoints: v.basisPoints, cents: v.vatCents })),
		paymentStatus: (status?.paymentStatus ?? order.paymentStatus) as ReceiptPaymentState,
		paymentMethod: order.paymentMethod === 'unknown' ? null : order.paymentMethod
	};
}
