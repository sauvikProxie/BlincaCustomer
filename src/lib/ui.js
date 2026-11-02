/* Blinca – shared UI actions (replaces the global data-action switch).
   Cart behaviour, favourites, clipboard, auth and overlay openers. */
import { page } from '#app/state';
import { openDrawer, openModal, closeAll, toast, toastError } from '#lib/layers.svelte.js';
import { restaurant, item, ensureMenu } from '#lib/stores/catalog.svelte.js';
import { cartRestaurant, addLine, decItem, subtotal } from '#lib/stores/cart.svelte.js';
import { setUser } from '#lib/stores/user.svelte.js';
import { t, lang } from '#lib/stores/language.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import { L } from '#lib/format.js';
import { toggleFav as doToggleFav } from '#lib/stores/favourites.svelte.js';
import { isDesignCheck, isLoggedIn } from '#lib/stores/session.svelte.js';
import { loginUrl } from '#lib/format.js';
import CartDrawerContent from '#lib/components/CartDrawerContent.svelte';
import OffersDrawer from '#lib/components/OffersDrawer.svelte';
import AddressModalContent from '#lib/components/AddressModalContent.svelte';
import AddressFormContent from '#lib/components/AddressFormContent.svelte';
import ItemModalContent from '#lib/components/ItemModalContent.svelte';
import SearchSheet from '#lib/components/SearchSheet.svelte';
import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
import { itemUnavailable } from '#lib/itemAvailability.js';

/** Backend cart error → user message (codes from customer.cart.addItem). @param {any} e @param {string} name */
function cartErrorText(e, name) {
	switch (e?.data?.code) {
		case 'ITEM_SOLD_OUT':
		case 'ITEM_UNAVAILABLE':
			return m.cart_reason_item_unavailable();
		case 'ITEM_OUTSIDE_SCHEDULE':
			return m.item_status_outside_schedule();
		case 'OPTION_SOLD_OUT':
			return m.cart_issue_option();
		case 'QUANTITY_INVALID':
			return m.cart_error_quantity();
		case 'CART_FULL':
			return m.cart_error_full();
		case 'NOTE_TOO_LONG':
			return m.cart_error_note();
		case 'RESTAURANT_CLOSED':
		case 'RESTAURANT_PAUSED':
		case 'RESTAURANT_UNAVAILABLE':
			return t('rest.notTaking', { name });
		default:
			return m.login_error_generic();
	}
}

/** @param {string} slug @param {string} itemId @param {Record<string, string[]>} [opts] @param {number} [qty] @param {string} [note] */
export async function addToCart(slug, itemId, opts, qty, note) {
	const r = restaurant(slug),
		it = item(slug, itemId);
	if (!r || !it) return;
	// Real mode: a closed restaurant can still take a scheduled order, so the backend
	// decides (addItem refuses only an unavailable one).
	if (isDesignCheck() && r.status !== 'open') {
		toastError(t('rest.notTaking', { name: r.name }));
		return;
	}
	const res = await addLine(slug, itemId, opts || {}, qty || 1, note);
	if (res === 'conflict') {
		const other = cartRestaurant();
		confirm({
			title: t('conflict.title'),
			text: t('conflict.text', { other: other.name, name: r.name }),
			ok: t('conflict.ok'),
			onOk: async () => {
				// One atomic swap: the backend drops the other cart in the same
				// write (clear-then-add could leave an empty cart behind).
				const put = await addLine(slug, itemId, opts || {}, qty || 1, note, { replaceCart: true });
				if (put === 'ok') toast(t('cart.added', { name: L(it.name, lang()) }));
				else toastError(cartErrorText(put, r.name));
			}
		});
		return;
	}
	if (res === 'ok') toast(t('cart.added', { name: L(it.name, lang()) }));
	else toastError(cartErrorText(res, r.name));
}

/** @param {string} slug @param {string} itemId */
export async function requestAdd(slug, itemId) {
	// The grid only has lightweight dishes; options and stock need the full menu.
	await ensureMenu(slug);
	const it = item(slug, itemId),
		r = restaurant(slug);
	if (!it || !r) return;
	// Real mode: a closed restaurant can still take a scheduled order, so the backend
	// decides (addItem refuses only an unavailable one).
	if (isDesignCheck() && r.status !== 'open') {
		toastError(t('rest.notTaking', { name: r.name }));
		return;
	}
	const why = itemUnavailable(it.availability, lang());
	if (why) {
		toastError(why);
		return;
	}
	if (it.options && it.options.length) openItemModal(slug, itemId);
	else addToCart(slug, itemId, {});
}

/** @param {string} slug @returns {boolean} true when added */
export function toggleFav(slug) {
	if (!isDesignCheck() && !isLoggedIn()) {
		// Browsing is public; saving a favourite needs an account.
		toast(t('fav.loginNeeded'));
		const next = page.url.pathname + page.url.search;
		import('#app/navigation').then(({ goto }) => goto(loginUrl(next)));
		return false;
	}
	const r = restaurant(slug);
	const on = doToggleFav(slug);
	if (r) toast(t(on ? 'fav.added' : 'fav.removed', { name: r.name }));
	return on;
}

/** @param {string} text @param {string} msg */
export function copyCode(text, msg) {
	const done = () => toast(msg);
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText)
		navigator.clipboard.writeText(text).then(done, () => toastError(m.copy_failed()));
	else toastError(m.copy_failed());
}

export function logout() {
	setUser(null);
	toast(t('acct.loggedOut'));
}

export function openCart() {
	openDrawer(CartDrawerContent, {}, { side: 'right', label: t('cart.title'), className: 'drawer-cart' });
}

export function openOffers() {
	openDrawer(OffersDrawer, {}, { side: 'right', label: t('home.offers') });
}

export function openAddressModal() {
	openModal(AddressModalContent, {}, { label: t('addr.choose') });
}

/** @param {any} [address] edit this row instead of adding; @param {(a: any) => void} [onSaved] */
export function openAddressForm(address, onSaved) {
	openModal(
		AddressFormContent,
		{ address, onSaved },
		{ label: t(address ? 'addr.editTitle' : 'addr.newTitle') }
	);
}

/** @param {string} slug @param {string} itemId */
export function openItemModal(slug, itemId) {
	openModal(ItemModalContent, { slug, itemId }, { className: 'modal-item', label: '' });
}

export function openSearchSheet() {
	openDrawer(SearchSheet, {}, { side: 'top', label: t('nav.search'), className: 'sheet-search' });
}

/** @param {{ title: string, text: string, ok: string, cancel?: string, onOk: () => void }} o */
export function confirm(o) {
	openModal(
		ConfirmDialog,
		{ title: o.title, text: o.text, ok: o.ok, cancel: o.cancel, onConfirm: o.onOk },
		{ className: 'modal-sm', label: o.title }
	);
}

export { decItem, subtotal, closeAll };
