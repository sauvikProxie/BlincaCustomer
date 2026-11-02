/* Blinca – orders store.
   Design-check: localStorage verbatim.
   Real mode: customer.orders.listRecentOrders + listActiveOrders (via layout),
   mapped to the source Order shape. Empty when logged out. addOrder is a
   design-check helper; real checkout uses checkout.placeOrder directly. */
import { read, write, seedIfNeeded } from './core.svelte.js';
import { restaurant, item, getSiteData, keyFor, normOpts } from './catalog.svelte.js';
import { cartRestaurant, addLine, clearCart, cartAddItem } from './cart.svelte.js';
import { t } from './language.svelte.js';
import { toast } from '../layers.svelte.js';
import { L } from '../format.js';
import { m } from '#lib/paraglide/messages.js';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@blinca/backend/convex/_generated/api';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { isDesignCheck, isLoggedIn, sessionCache } from './session.svelte.js';

/** @type {any[]} mapped backend orders */
let backendOrders = $state([]);
/** Loading/error of the live orders feed, so screens can tell "none yet" from "not loaded". */
let feed = $state({ loading: false, error: false });
/** @param {boolean} loading @param {boolean} error */
export function setOrdersFeed(loading, error) {
	feed = { loading, error };
}
export const ordersFeed = () => feed;
/**
 * @param {any[]} cards OrderCards (active + recent)
 * @param {(id:string)=>string} slugFor restaurantId → slug
 */
export function setOrdersCache(cards, slugFor) {
	backendOrders = (cards || []).map((o) => {
		const slug = slugFor ? slugFor(String(o.restaurantId)) : '';
		const total = (o.totalCents ?? 0) / 100;
		return {
			id: String(o._id),
			_id: o._id,
			slug,
			date: new Date(o.placedAt || Date.now()).toISOString(),
			amount: total,
			total,
			fee: (o.deliveryFeeCents ?? 0) / 100,
			paid: o.paymentStatus === 'paid',
			refunded: o.paymentStatus === 'refunded',
			phone: o.customerPhone || '',
			address: o.deliveryAddress || null,
			discount: ((o || {}).discountCents || 0) / 100,
			mode: o.fulfillment === 'pickup' ? 'pickup' : 'delivery',
			status: o.status,
			deliveredAt: o.deliveredAt ?? null,
			items: (o.items || []).map((i) => ({
				itemId: i.nameSv || i.nameEn || '',
				name: i.nameSv || '',
				nameEn: i.nameEn,
				variant: i.variantName ? { sv: i.variantName, en: i.variantNameEn || i.variantName } : null,
				price: (i.unitPriceCents ?? 0) / 100,
				lineTotal: i.lineTotalCents != null ? i.lineTotalCents / 100 : null,
				opts: {},
				qty: i.quantity
			}))
		};
	});
}

/**
 * Display name for one order line. Real orders carry the name on the line
 * (menus change after the fact); design-check orders resolve it from the
 * catalog. Falls back to the raw id only if both are missing.
 * @param {string} slug @param {any} li @param {string} lang
 */
export function lineLabel(slug, li, lang) {
	const stored = li && li.name ? { sv: li.name, en: li.nameEn ?? li.name } : null;
	const it = stored ? null : item(slug, li.itemId);
	const name = stored ? L(stored, lang) : it ? L(it.name, lang) : li.itemId;
	// The size the order was placed with ("Cola · 50 cl").
	return li?.variant ? name + ' · ' + L(li.variant, lang) : name;
}

/** @returns {import('#lib/types.js').Order[]} */
export function orders() {
	if (isDesignCheck()) {
		return read('orders', [])
			.filter((/** @type {any} */ o) => restaurant(o.slug))
			.sort((/** @type {any} */ a, /** @type {any} */ b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
	}
	if (!isLoggedIn()) return [];
	return backendOrders
		.filter((/** @type {any} */ o) => !o.slug || restaurant(o.slug))
		.sort((/** @type {any} */ a, /** @type {any} */ b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** @param {any} o */
export function addOrder(o) {
	if (isDesignCheck()) {
		const list = read('orders', []);
		list.push(o);
		write('orders', list);
		return;
	}
	// Real mode: orders arrive via subscription after placeOrder; ignore fakes.
	console.warn('[orders] addOrder(fake) ignored in real mode');
}

/** @param {any[]} lines */
function splittable(lines) {
	return (lines || []).filter(
		(l) => l && (l.availability?.kind === 'ok' || l.availability?.kind === 'price_changed')
	);
}

/**
 * Reorder a past order at current backend prices. Design-check re-adds the
 * sample lines locally; real mode loads `getReorderLines` (ids + live
 * availability), confirms on cross-restaurant conflict (`replaceCart`), skips
 * unavailable lines with a toast naming them, then opens the cart drawer.
 * @param {string} orderId
 */
export async function reorderOrder(orderId) {
	const { confirm, openCart } = await import('#lib/ui.js');
	if (isDesignCheck()) {
		const o = orders().find((x) => x && x.id === orderId);
		if (!o) return;
		const place = () => {
			for (const l of o.items || []) addLine(o.slug, l.itemId, l.opts, l.qty);
			openCart();
			toast(m.reorder_added({ n: (o.items || []).reduce((n, l) => n + (l.qty || 0), 0) }));
		};
		const cur = cartRestaurant();
		if (cur && cur.slug !== o.slug) {
			confirm({
				title: t('conflict.title'),
				text: t('conflict.text', { other: cur.name, name: (restaurant(o.slug) || {}).name || o.slug }),
				ok: t('conflict.ok'),
				onOk: () => {
					clearCart();
					place();
				}
			});
			return;
		}
		place();
		return;
	}
	if (!isLoggedIn()) return;
	const client = sessionCache.authClient;
	let token = null;
	try {
		const res = await client?.convex?.token({ fetchOptions: { throw: false } });
		token = res?.data?.token ?? null;
	} catch {
		token = null;
	}
	let data = null;
	if (token) {
		try {
			const http = new ConvexHttpClient(PUBLIC_CONVEX_URL);
			http.setAuth(token);
			data = await http.query(api.customer.orders.getReorderLines, { orderId });
		} catch {
			data = null;
		}
	}
	if (!data) {
		toast(m.reorder_failed());
		return;
	}
	const okLines = splittable(data.lines);
	const skipped = (data.lines || [])
		.filter((l) => !(l.availability?.kind === 'ok' || l.availability?.kind === 'price_changed'))
		.map((l) => l.name);
	if (!okLines.length) {
		toast(skipped.length ? m.reorder_skipped({ names: skipped.join(', ') }) : m.reorder_empty());
		return;
	}
	const placeAll = async (replace) => {
		let added = 0;
		for (let i = 0; i < okLines.length; i++) {
			const l = okLines[i];
			try {
				const p = cartAddItem({
					restaurantId: data.restaurantId,
					itemId: l.menuItemId,
					...(l.variantId ? { variantId: l.variantId } : {}),
					optionIds: l.optionIds,
					quantity: l.quantity,
					...(l.note ? { note: l.note } : {}),
					...(replace && i === 0 ? { replaceCart: true } : {})
				});
				if (!p) {
					skipped.push(l.name);
					continue;
				}
				await p;
				added += l.quantity;
			} catch {
				skipped.push(l.name);
			}
		}
		openCart();
		toast(m.reorder_added({ n: added }));
		if (skipped.length) toast(m.reorder_skipped({ names: skipped.join(', ') }));
	};
	const cur = cartRestaurant();
	if (cur && data.restaurantSlug && cur.slug !== data.restaurantSlug) {
		const target = restaurant(data.restaurantSlug);
		confirm({
			title: t('conflict.title'),
			text: t('conflict.text', { other: cur.name, name: (target || {}).name || data.restaurantSlug }),
			ok: t('conflict.ok'),
			onOk: () => {
				void placeAll(true);
			}
		});
		return;
	}
	await placeAll(false);
}
