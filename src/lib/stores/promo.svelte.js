/* Blinca – promo-code engine (real mode).
   Design-check: unused (local sample promos flow through cart pricing).
   Real mode: holds the applied code and fetches checkout.preview (debounced)
   for the current fulfillment/address/restaurant/cart — with or without a code.
   pricing() takes every number (subtotal, fee, discount, VAT, total, minimum)
   from the preview; while it is missing or stale the totals read as loading. */
import { untrack } from 'svelte';
import { browser } from '#app/env';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@blinca/backend/convex/_generated/api';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { poke } from './core.svelte.js';
import { isDesignCheck, isLoggedIn, sessionCache } from './session.svelte.js';
import { m } from '#lib/paraglide/messages.js';

/** @typedef {{ fulfillment?: string, restaurantId?: any, addressId?: any, postalCode?: string, scheduledFor?: number, cartSig?: string }} PreviewCtx */

/** @type {any|null} last preview view for the current context. */
let previewCache = $state(null);
/** The last preview received and the restaurant it priced. Unlike previewCache it
 *  survives re-prices, so the totals can stay on screen (faded) while a fresh
 *  preview loads; forgotten when the cart empties or the restaurant changes.
 *  @type {{ view: any, restaurantId: string }|null} */
let lastPreview = $state(null);
/** @type {any|null} context the cache belongs to. */
let cachedCtx = null;
let timer = 0;
/** @type {any|null} latest requested context. */
let pendingCtx = null;

/* The applied code lives only in memory (never localStorage): nothing is
   applied until the user types/pastes a code into the promo box and hits
   Apply. Stale codes can never ride along into fingerprint/placeOrder. */
/** @type {string|null} */
let current = $state(null);

/* A code copied from an offer: pre-fills the promo box, never applied by itself. */
let draft = $state('');

/** @returns {string} */
export function promoDraft() {
	return draft;
}

/** @param {string} code */
export function setPromoDraft(code) {
	draft = code;
}

/** @returns {string|null} */
export function promoCode() {
	return current;
}

/** @param {string|null} code */
export function setPromo(code) {
	current = code ? String(code).trim().toUpperCase() || null : null;
	// Drop any preview for the previous code; pricing() re-fetches with
	// context on next read.
	previewCache = null;
	cachedCtx = null;
}

/** Drop the cached preview (the cart changed server-side and may reprice). */
export function clearPreview() {
	previewCache = null;
	cachedCtx = null;
}

/** Backend reason → localized message. @param {any} issue */
export function promoIssueMessage(issue) {
	if (!issue || issue.code !== 'PROMO_INVALID') return '';
	switch (issue.promoReason) {
		case 'NOT_FOUND':
			return m.promo_reason_not_found();
		case 'INACTIVE':
			return m.promo_reason_inactive();
		case 'EXPIRED':
			return m.promo_reason_expired();
		case 'NOT_YET_VALID':
			return m.promo_reason_not_yet();
		case 'WRONG_DAY':
			return m.promo_reason_wrong_day();
		case 'MIN_ORDER':
			// Backend reports the shortfall in öre; the message renders kronor.
			// Round up so the suggested amount always reaches the minimum.
			return m.promo_reason_min_order({ n: Math.ceil((issue.promoShortfallCents ?? 0) / 100) });
		case 'WRONG_RESTAURANT':
			return m.promo_reason_wrong_restaurant();
		case 'WRONG_FULFILLMENT':
			return m.promo_reason_wrong_fulfillment();
		case 'LIMIT_REACHED':
			return m.promo_reason_limit();
		case 'FIRST_ORDER_ONLY':
			return m.promo_reason_first_order();
		default:
			return m.promo_reason_generic();
	}
}

/**
 * Re-fetch preview for a promo context (fulfillment/address). Callers pass
 * their context; concurrent callers share one debounced refresh.
 * @param {PreviewCtx} [ctx]
 */
export async function refreshPreview(ctx = {}) {
	if (isDesignCheck() || !browser || !isLoggedIn()) return null;
	const code = promoCode();
	const client = sessionCache.authClient;
	let token = null;
	try {
		const res = await client?.convex?.token({ fetchOptions: { throw: false } });
		token = res?.data?.token ?? null;
	} catch {
		token = null;
	}
	if (!token) return null;
	try {
		const http = new ConvexHttpClient(PUBLIC_CONVEX_URL);
		http.setAuth(token);
		const view = await http.query(api.customer.checkout.preview, {
			fulfillment: ctx.fulfillment === 'pickup' ? 'pickup' : 'delivery',
			...(ctx.addressId !== undefined ? { addressId: ctx.addressId } : {}),
			...(ctx.addressId === undefined && ctx.postalCode ? { postalCode: ctx.postalCode } : {}),
			...(ctx.scheduledFor != null ? { scheduledFor: ctx.scheduledFor } : {}),
			...(code ? { promoCode: code } : {})
		});
		previewCache = view;
		lastPreview = { view, restaurantId: String(ctx.restaurantId ?? '') };
		cachedCtx = {
			code,
			fulfillment: ctx.fulfillment,
			restaurantId: ctx.restaurantId,
			addressId: ctx.addressId,
			postalCode: ctx.postalCode,
			scheduledFor: ctx.scheduledFor,
			cartSig: ctx.cartSig
		};
		poke();
		return view;
	} catch {
		return null;
	}
}

/** @param {PreviewCtx} [ctx] */
export function previewFor(ctx = {}) {
	if (!cachedCtx || !previewCache) return null;
	const code = promoCode();
	if (
		cachedCtx.code !== code ||
		(cachedCtx.fulfillment || 'delivery') !== (ctx.fulfillment || 'delivery') ||
		String(cachedCtx.restaurantId ?? '') !== String(ctx.restaurantId ?? '') ||
		String(cachedCtx.addressId ?? '') !== String(ctx.addressId ?? '') ||
		String(cachedCtx.postalCode ?? '') !== String(ctx.postalCode ?? '') ||
		String(cachedCtx.scheduledFor ?? '') !== String(ctx.scheduledFor ?? '') ||
		// The cart changed since this preview was priced: its numbers are stale.
		String(cachedCtx.cartSig ?? '') !== String(ctx.cartSig ?? '')
	) {
		return null;
	}
	return previewCache;
}

/** The previous preview for this cart (same restaurant), however old; null if none.
 *  @param {PreviewCtx} [ctx] */
export function lastPreviewFor(ctx = {}) {
	return lastPreview && lastPreview.restaurantId === String(ctx.restaurantId ?? '') ? lastPreview.view : null;
}

/** The cart is empty or gone: no totals to keep showing. */
export function forgetPreview() {
	// Called from pricing(), which templates read inside $derived: an untracked write
	// avoids state_unsafe_mutation (a 500 on /checkout with an empty cart).
	if (lastPreview !== null) untrack(() => (lastPreview = null));
}

/** Queue a refresh for the given context (fire-and-forget). @param {any} [ctx] */
export function ensurePreview(ctx) {
	if (isDesignCheck() || !browser || !isLoggedIn()) return;
	// A cached preview for this exact context is fresh: without this the
	// poke() in refreshPreview re-triggers pricing() → ensurePreview() forever.
	if (previewFor(ctx)) return;
	pendingCtx = ctx || {};
	if (timer) return;
	timer = window.setTimeout(() => {
		timer = 0;
		const args = pendingCtx;
		pendingCtx = null;
		void refreshPreview(args);
	}, 400);
}
