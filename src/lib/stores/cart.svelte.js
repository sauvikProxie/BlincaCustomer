/* Blinca – cart store.
   Design-check: localStorage verbatim (source behaviour).
   Real mode: mirrors customer.cart.get live (via root subscription layer).
   Getters stay sync reading the backend cache mapped to source line shape.
   Mutations call customer.cart.* via registered useMutation fns (optimistic).
   Logged-out adds save a pending cart in sessionStorage and go to login
   (old-app behaviour), replayed after sign-in. Promo codes delegate to the
   promo engine (checkout.preview); design-check keeps local sample promos. */
import { browser } from '#app/env';
import { read, write } from './core.svelte.js';
import { hasValidPostcode, postcodeDigits } from '../postcode.js';
import { toCents } from '../money.js';
import { VARIANT_GROUP, splitOpts } from '../variants.js';
import { restaurant, item, normOpts, keyFor, unitPrice, getSiteData } from './catalog.svelte.js';
import { t } from './language.svelte.js';
import { isDesignCheck, isLoggedIn } from './session.svelte.js';
import { address } from './address.svelte.js';
import {
	promoCode as engineCode,
	setPromo as engineSetPromo,
	previewFor,
	lastPreviewFor,
	forgetPreview,
	ensurePreview,
	clearPreview,
	promoIssueMessage
} from './promo.svelte.js';

/** @type {any|null} backend CartView cache (reactive so getters update live). */
let backendCart = $state(null);
/** @param {any|null} view */
export function setCartCache(view) {
	backendCart = view || null;
	if (!view) forgetPreview();
	// A server-side cart change reprices it (or switches restaurant), so a
	// cached preview's fee/minimum may no longer be this cart's.
	clearPreview();
}
/** Registered Convex mutations from layout. */
let cartMuts = { addItem: null, setQuantity: null, removeItem: null, clear: null };
/** @param {{addItem?:any,setQuantity?:any,removeItem?:any,clear?:any}} m */
export function setCartMutations(m) {
	cartMuts = { ...cartMuts, ...(m || {}) };
}

/**
 * Direct `customer.cart.addItem` passthrough for engine flows that already hold
 * backend ids (e.g. reorder). Returns the mutation promise, or null when the
 * layout has not registered mutations (SSR / design-check).
 * @param {any} args
 */
export function cartAddItem(args) {
	return cartMuts.addItem ? cartMuts.addItem(args) : null;
}

const PENDING_KEY = 'blinca-pending-cart';

/** Map backend option list → source opts record via catalog groups. */
function optsFromBackend(slug, menuItemId, backendOpts, variantId) {
	const dish = item(slug, String(menuItemId));
	/** @type {Record<string, string[]>} */
	const out = {};
	// The chosen size is a one-choice group of the dish (see variants.js).
	if (variantId) out[VARIANT_GROUP] = [String(variantId)];
	if (!dish || !dish.options) {
		if ((backendOpts || []).length) out['opts'] = (backendOpts || []).map((o) => String(o.optionId));
		return normOpts(out);
	}
	for (const o of backendOpts || []) {
		const oid = String(o.optionId);
		let gid = null;
		for (const g of dish.options) {
			if ((g.choices || []).some((c) => String(c.id) === oid)) {
				gid = g.id;
				break;
			}
		}
		if (!gid) gid = 'opts';
		const q = Math.max(1, o.quantity || 1);
		for (let i = 0; i < q; i++) (out[gid] = out[gid] || []).push(oid);
	}
	return normOpts(out);
}

/** Backend CartView lines → source CartLine[] (with _lineId for mutations). */
function mappedLines() {
	if (!backendCart || !backendCart.restaurant) return [];
	const slug = backendCart.restaurant.slug;
	const out = [];
	for (const l of backendCart.lines || []) {
		const itemId = String(l.menuItemId);
		if (!item(slug, itemId)) continue;
		if (!(l.quantity > 0)) continue;
		const opts = optsFromBackend(slug, itemId, l.options, l.variantId);
		const note = l.note || '';
		out.push({
			key: keyFor(slug, itemId, opts, note),
			slug,
			itemId,
			opts,
			qty: l.quantity,
			note,
			_lineId: l.lineId
		});
	}
	return out;
}

/** Key for a backend view line (identical to what mappedLines() derives). */
function viewKey(slug, view) {
	return keyFor(
		slug,
		String(view.menuItemId),
		optsFromBackend(slug, String(view.menuItemId), view.options, view.variantId),
		view.note || ''
	);
}

/** Collapse flat option ids with repeat counts, backend option-view shape. */
function optionViews(optionIds) {
	const counts = new Map();
	for (const id of optionIds || []) counts.set(String(id), (counts.get(String(id)) ?? 0) + 1);
	return [...counts.entries()].map(([optionId, quantity]) => ({ optionId, quantity }));
}

/** Is this a locally-mirrored line still awaiting its server round-trip? */
function isPending(view) {
	return typeof view?.lineId === 'string' && view.lineId.indexOf('pending-') === 0;
}

/** @returns {import('#lib/types.js').CartLine[]} */
export function cart() {
	if (isDesignCheck())
		return read('cart', []).filter((/** @type {any} */ l) => l && item(l.slug, l.itemId) && l.qty > 0);
	if (!isLoggedIn()) return [];
	return mappedLines();
}

/**
 * Backend lines whose dish is gone (ITEM_REMOVED): they carry no price and no
 * source key, so cart() cannot show them — but they must stay removable or the
 * order can never go through.
 * @returns {Array<{ lineId: string }>}
 */
export function staleLines() {
	if (isDesignCheck() || !isLoggedIn() || !backendCart) return [];
	return (backendCart.lines || [])
		.filter((/** @type {any} */ l) => (l.issues || []).indexOf('ITEM_REMOVED') >= 0)
		.map((/** @type {any} */ l) => ({ lineId: String(l.lineId) }));
}

/** @returns {any|null} */
export function cartRestaurant() {
	const c = cart();
	return c.length ? restaurant(c[0].slug) : null;
}

/** @returns {number} */
export function count() {
	return cart().reduce((n, l) => n + l.qty, 0);
}

/** @param {import('#lib/types.js').CartLine} l */
export function lineTotal(l) {
	return unitPrice(l.slug, l.itemId, l.opts) * l.qty;
}

/** @returns {number} */
export function subtotal() {
	return cart().reduce((n, l) => n + lineTotal(l), 0);
}

/** @param {string} slug @param {string} itemId */
export function itemQty(slug, itemId) {
	return cart().reduce((n, l) => n + (l.slug === slug && l.itemId === itemId ? l.qty : 0), 0);
}

/* Resolves 'ok' (added, or queued behind the login redirect), 'conflict'
   (cart holds another restaurant) — or resolves with the thrown error when the
   backend refused the line, so the caller can explain why. */
/** @param {string} slug @param {string} itemId @param {Record<string, string[]>} [opts] @param {number} [qty] @param {string} [note] @param {{ replaceCart?: boolean }} [o] */
export async function addLine(slug, itemId, opts, qty, note, o) {
	const replaceCart = !!(o && o.replaceCart);
	if (isDesignCheck()) {
		const c = replaceCart ? [] : cart();
		if (!replaceCart && c.length && c[0].slug !== slug) return 'conflict';
		// Replacing drops the old restaurant's cart — and its promo code.
		if (replaceCart) write('promo', null);
		note = (note || '').trim();
		const key = keyFor(slug, itemId, opts, note);
		/** @type {any} */
		let found = null;
		c.forEach((l) => {
			if (l.key === key) found = l;
		});
		if (found) found.qty += qty || 1;
		else c.push({ key, slug, itemId, opts: normOpts(opts), qty: qty || 1, note });
		write('cart', c);
		return 'ok';
	}
	// Real mode.
	if (!isLoggedIn()) {
		if (browser) {
			try {
				sessionStorage.setItem(
					PENDING_KEY,
					JSON.stringify({ slug, itemId, opts: normOpts(opts), qty: qty || 1, note: (note || '').trim() })
				);
			} catch {}
			import('#app/navigation').then(({ goto }) => goto('/login?next=' + encodeURIComponent('/')));
		}
		return 'ok';
	}
	const c = cart();
	if (!replaceCart && c.length && c[0].slug !== slug) return 'conflict';
	const cleanNote = (note || '').trim();
	const r = restaurant(slug);
	const restaurantId = r && r._restaurantId ? r._restaurantId : null;
	if (!restaurantId || !cartMuts.addItem) return 'ok';
	const normed = normOpts(opts);
	const { variantId, optionIds } = splitOpts(normed);
	const key = keyFor(slug, itemId, normed, cleanNote);
	// Optimistic mirror: the UI updates instantly; the subscription reconciles.
	// A failed add is rolled back in the catch (nothing re-reads for it).
	const prior = backendCart;
	{
		const base =
			backendCart && backendCart.restaurant && backendCart.restaurant.slug === slug
				? backendCart
				: { restaurant: { slug }, lines: [] };
		const lines = (base.lines || []).slice();
		const idx = lines.findIndex((v) => viewKey(slug, v) === key);
		if (idx >= 0) lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + (qty || 1) };
		else
			lines.push({
				lineId: 'pending-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
				menuItemId: itemId,
				...(variantId ? { variantId } : {}),
				quantity: qty || 1,
				...(cleanNote ? { note: cleanNote } : {}),
				options: optionViews(optionIds)
			});
		backendCart = { ...base, lines };
	}
	const mirrored = backendCart;
	try {
		await cartMuts.addItem({
			restaurantId,
			itemId,
			...(variantId ? { variantId } : {}),
			optionIds,
			quantity: qty || 1,
			...(cleanNote ? { note: cleanNote } : {}),
			...(replaceCart ? { replaceCart: true } : {})
		});
		return 'ok';
	} catch (e) {
		console.warn('[cart] addItem failed', e);
		// Undo the mirror unless a live push already replaced it.
		if (backendCart === mirrored) backendCart = prior;
		return e;
	}
}

/** @param {string} slug @param {string} itemId */
export function decItem(slug, itemId) {
	if (isDesignCheck()) {
		const c = cart();
		for (let i = c.length - 1; i >= 0; i--) {
			if (c[i].slug === slug && c[i].itemId === itemId) {
				c[i].qty -= 1;
				if (c[i].qty <= 0) c.splice(i, 1);
				break;
			}
		}
		write('cart', c);
		return;
	}
	const lines = cart();
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].slug === slug && lines[i].itemId === itemId) {
			const line = lines[i];
			const nq = line.qty - 1;
			if (backendCart && backendCart.lines) {
				const next = backendCart.lines.slice();
				const idx = next.findIndex((v) => String(v.lineId) === String(line._lineId));
				if (idx >= 0) {
					if (nq <= 0) next.splice(idx, 1);
					else next[idx] = { ...next[idx], quantity: nq };
					backendCart = { ...backendCart, lines: next };
				}
			}
			if (cartMuts.setQuantity && line._lineId && !isPending(line)) {
				cartMuts.setQuantity({ lineId: line._lineId, quantity: Math.max(0, nq) }).catch((e) => console.warn('[cart] setQuantity failed', e));
			}
			break;
		}
	}
}

/** @param {string} key @param {number} delta */
export function changeQty(key, delta) {
	if (isDesignCheck()) {
		const c = cart();
		for (let i = 0; i < c.length; i++) {
			if (c[i].key === key) {
				c[i].qty += delta;
				if (c[i].qty <= 0) c.splice(i, 1);
				break;
			}
		}
		write('cart', c);
		return;
	}
	const line = cart().find((l) => l.key === key);
	if (!line || !line._lineId || !cartMuts.setQuantity) return;
	const nq = Math.max(0, line.qty + delta);
	if (backendCart && backendCart.lines) {
		const next = backendCart.lines.slice();
		const idx = next.findIndex((v) => String(v.lineId) === String(line._lineId));
		if (idx >= 0) {
			if (nq <= 0) next.splice(idx, 1);
			else next[idx] = { ...next[idx], quantity: nq };
			backendCart = { ...backendCart, lines: next };
		}
	}
	if (isPending(line)) return;
	cartMuts.setQuantity({ lineId: line._lineId, quantity: nq }).catch((e) => console.warn('[cart] setQuantity failed', e));
}

/** @param {string} key */
export function removeLine(key) {
	if (isDesignCheck()) {
		write(
			'cart',
			cart().filter((l) => l.key !== key)
		);
		return;
	}
	const line = cart().find((l) => l.key === key);
	if (line) removeLineById(line._lineId);
}

/** Drop a backend line by id — the only handle a stale line has.
 * @param {string} lineId */
export function removeLineById(lineId) {
	if (isDesignCheck() || !lineId || !cartMuts.removeItem) return;
	if (backendCart && backendCart.lines) {
		backendCart = {
			...backendCart,
			lines: backendCart.lines.filter((v) => String(v.lineId) !== String(lineId))
		};
	}
	if (isPending({ lineId })) return;
	cartMuts.removeItem({ lineId }).catch((e) => console.warn('[cart] remove failed', e));
}

export function clearCart() {
	if (isDesignCheck()) {
		write('cart', []);
		write('promo', null);
		return;
	}
	write('promo', null);
	if (cartMuts.clear) cartMuts.clear({}).catch((e) => console.warn('[cart] clear failed', e));
	if (backendCart) backendCart = { ...backendCart, lines: [] };
}

/** Replay a logged-out pending add after sign-in (layout calls once). */
export async function replayPendingCart() {
	if (isDesignCheck() || !browser || !isLoggedIn()) return;
	let raw = null;
	try {
		raw = sessionStorage.getItem(PENDING_KEY);
	} catch {
		return;
	}
	if (!raw) return;
	try {
		sessionStorage.removeItem(PENDING_KEY);
	} catch {}
	let p = null;
	try {
		p = JSON.parse(raw);
	} catch {
		return;
	}
	if (!p || !p.slug || !p.itemId) return;
	addLine(p.slug, p.itemId, p.opts, p.qty, p.note);
}

/**
 * Fulfillment/address context for promo preview fetches. Shared by pricing()
 * and the promo box so an apply refresh reads the same cache entry pricing()
 * will later resolve. The restaurant is part of the key (the preview prices the
 * cart's own restaurant, so a switch must refetch the zone fee).
 * `scheduledFor` (a chosen slot, ms) lets the preview check that slot; `cartSig`
 * invalidates a cached preview when the cart changes.
 * @param {string} [mode] @param {number} [scheduledFor]
 * @returns {{ fulfillment: string; restaurantId?: any; addressId?: any; postalCode?: string; scheduledFor?: number; cartSig?: string }}
 */
export function promoContext(mode, scheduledFor) {
	const addr = address();
	const r = cartRestaurant();
	return {
		fulfillment: mode || deliveryMode(),
		...(r && r._restaurantId ? { restaurantId: r._restaurantId } : {}),
		// An address whose postcode cannot be normalised is never sent (checkout blocks it).
		...(addr && addr._id && hasValidPostcode(addr) ? { addressId: addr._id } : {}),
		...(!(addr && addr._id) && postcodeDigits(addr?.zip) ? { postalCode: postcodeDigits(addr.zip) } : {}),
		...(scheduledFor != null ? { scheduledFor } : {}),
		...(isDesignCheck()
			? {}
			: { cartSig: cart().map((l) => `${l._lineId ?? l.key}:${l.qty}:${l.note || ''}`).join('|') })
	};
}

/** Pricing: subtotal, delivery fee, promo discount, VAT, total. Real mode: every
 * number comes from checkout.preview (per-item VAT, zone fee, server-validated
 * promo). While a fresh preview loads for a changed cart the previous one for the
 * same cart stays (`stale`, callers fade it); only a cart that has never been
 * priced is `loading` (numbers 0, callers show "…"). Neither is ever a client sum.
 * Design-check: local sample promos, verbatim.
 * @param {string} [mode] @param {number} [scheduledFor] slot (ms) to check
 * @returns {import('#lib/types.js').Pricing} */
export function pricing(mode, scheduledFor) {
	if (!isDesignCheck()) {
		const r = cartRestaurant();
		mode = mode || deliveryMode();
		const code = promoCode();
		const ctx = promoContext(mode, scheduledFor);
		const base = { r, sub: 0, fee: 0, discount: 0, total: 0, vat: 0, min: null, mode, loading: false, stale: false };
		const pending = code ? { code, valid: false, msg: '' } : null;
		if (!cart().length) {
			forgetPreview();
			return { ...base, promo: pending };
		}
		const fresh = previewFor(ctx);
		ensurePreview(ctx);
		const view = fresh ?? lastPreviewFor(ctx);
		if (!view) return { ...base, loading: true, promo: pending };
		const bad = (view.issues || []).find((/** @type {any} */ i) => i.code === 'PROMO_INVALID');
		/** @type {{ code: string, valid: boolean, msg: string, label?: string }|null} */
		const promo = code ? { code, valid: !bad, msg: bad ? promoIssueMessage(bad) : '', label: code } : null;
		// No delivery zone (no address yet, or outside every zone) prices the fee at
		// 0, which is not "free delivery": show the restaurant's own fee as the estimate.
		const noZone = mode === 'delivery' && view.zoneName == null;
		const feeCents = noZone ? toCents(r?.fee ?? 0) : (view.deliveryFeeCents ?? 0);
		return {
			...base,
			stale: !fresh,
			sub: view.subtotalCents / 100,
			fee: feeCents / 100,
			discount: view.discountCents / 100,
			total: (view.totalCents - (view.deliveryFeeCents ?? 0) + feeCents) / 100,
			vat: view.vatCents / 100,
			min: view.minimumCents != null ? view.minimumCents / 100 : null,
			promo,
			view
		};
	}
	const D = getSiteData();
	const r = cartRestaurant();
	const sub = subtotal();
	mode = mode || deliveryMode();
	const fee = r && mode === 'delivery' ? r.fee : 0;
	let discount = 0;
	/** @type {{ code: string, valid: boolean, msg: string, label?: string }|null} */
	let promo = null;
	const code = promoCode();
	if (code && r) {
		const o = D.offers.filter((/** @type {any} */ x) => x.code === code)[0];
		promo = { code, valid: false, msg: '' };
		if (!o) promo.msg = t('promo.unknown');
		else if (o.rule.weekday != null && new Date().getDay() !== o.rule.weekday)
			promo.msg = t('promo.tuesday');
		else if (o.rule.untilHour != null && new Date().getHours() >= o.rule.untilHour)
			promo.msg = t('promo.ended');
		else if (o.rule.type === 'freeDelivery') {
			if (mode !== 'delivery') promo.msg = t('promo.deliveryOnly');
			else if (sub < (o.rule.min ?? 0))
				promo.msg = t('promo.spendMore', { n: (o.rule.min ?? 0) - sub });
			else {
				promo.valid = true;
				discount = fee;
				promo.label = t('promo.freeDelivery');
			}
		} else if (o.rule.type === 'percent') {
			promo.valid = true;
			discount = Math.round((sub * (o.rule.value ?? 0)) / 100);
			promo.label = o.rule.value + ' %';
		}
	}
	const total = Math.max(0, sub + fee - discount);
	const vatBase = Math.max(
		0,
		sub - (promo && promo.valid && promo.label !== t('promo.freeDelivery') ? discount : 0)
	);
	const vat = Math.floor(((vatBase * D.vatRate) / (1 + D.vatRate)) * 100) / 100;
	return { r, sub, fee, discount, total, vat, min: r?.minOrder ?? null, promo, mode };
}

/* delivery mode + promo live here so cart totals stay in one module */
/** @returns {'delivery' | 'pickup'} */
export function deliveryMode() {
	return read('mode', 'delivery') === 'pickup' ? 'pickup' : 'delivery';
}

/** @param {string} m */
export function setDeliveryMode(m) {
	write('mode', m === 'pickup' ? 'pickup' : 'delivery');
}

/** @returns {string|null} */
export function promoCode() {
	if (isDesignCheck()) return read('promo', null);
	return engineCode();
}

/** @param {string|null} code */
export function setPromo(code) {
	if (isDesignCheck()) {
		write('promo', code || null);
		return;
	}
	engineSetPromo(code);
}
