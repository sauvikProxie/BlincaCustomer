/* Blinca – address store.
   Design-check: SiteData.addresses + local myAddresses verbatim.
   Real mode: marketplace.listMyAddresses (via layout subscription) plus
   marketplace.createMyAddress/updateMyAddress for the form's save (mutations
   registered by the layout). Empty when logged out. */
import { read, write } from './core.svelte.js';
import { getSiteData } from './catalog.svelte.js';
import { isDesignCheck, isLoggedIn } from './session.svelte.js';

/** @type {any[]} backend-mapped cache, set by the root subscription layer. */
let backendCache = $state([]);
/** @param {any[]} rows Convex customerAddresses rows */
export function setAddressCache(rows) {
	backendCache = (rows || []).map((r) => ({
		id: String(r._id),
		_id: r._id,
		label: r.label,
		street: r.street,
		zip: r.postalCode,
		city: r.city,
		lat: r.lat,
		lng: r.lng,
		deliverable: true,
		extraEta: 0,
		isDefault: !!r.isDefault
	}));
}

/** Registered Convex mutations from the layout (real mode only). */
let addrMuts = { create: null, update: null, delete: null };
/** @param {{create?: any, update?: any, delete?: any}} m */
export function setAddressMutations(m) {
	addrMuts = { ...addrMuts, ...(m || {}) };
}

/** Form row → mutation args. `zip` is the form's name for postalCode, and a
 *  missing pin is omitted so an edit keeps the coordinates already saved.
 *  @param {any} a */
function argsFor(a) {
	return {
		label: a.label,
		street: a.street,
		postalCode: a.zip,
		city: a.city,
		...(a.lat != null ? { lat: a.lat } : {}),
		...(a.lng != null ? { lng: a.lng } : {})
	};
}

/** A visitor's address lives in this browser only (never sent anywhere). */
const guestKey = () => (isLoggedIn() ? 'myAddresses' : 'guestAddresses');

/**
 * The selected address id. A stored pick wins when it still names a saved address;
 * otherwise (first visit, or the design-check default 'home' next to real backend ids)
 * the default address, then the first one, so every view agrees on what is selected.
 * @returns {string}
 */
export function addressId() {
	const stored = read('address', 'home');
	const all = allAddresses();
	if (all.some((a) => a.id === stored)) return stored;
	return (all.find((a) => a.isDefault) || all[0])?.id ?? stored;
}

/** @returns {any} */
export function address() {
	const id = addressId(),
		all = allAddresses();
	for (let i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
	if (all[0]) return all[0];
	// Real-mode logged-out: no saved addresses yet. Return a neutral placeholder
	// so the header (which assumes an address exists) renders instead of 500ing
	// during prerender/SSR. Never persisted, never sent to checkout.
	if (!isDesignCheck()) return { id: '', label: '', street: 'Stockholm', zip: '', city: 'Stockholm', deliverable: true, extraEta: 0 };
	return all[0];
}

/** @param {string} id */
export function setAddress(id) {
	write('address', id);
}

/** Local edits over rows with no backend row (design-check seeds, older locally
 *  added addresses). @param {any[]} list */
function withEdits(list) {
	const edits = read('addressEdits', {});
	return list.map((a) => (edits[a.id] ? { ...a, ...edits[a.id], id: a.id } : a));
}

/** @returns {any[]} */
export function allAddresses() {
	if (isDesignCheck()) return withEdits(getSiteData().addresses.concat(read('myAddresses', [])));
	if (!isLoggedIn()) return read('guestAddresses', []);
	return withEdits(backendCache.concat(read('myAddresses', [])));
}

/**
 * Save a new address: design-check writes the source's local list, real mode
 * goes through the backend and mirrors the row until the subscription lands.
 * Throws (and adds nothing) when the save fails.
 * @param {any} a
 */
export async function addAddress(a) {
	if (isDesignCheck() || !isLoggedIn()) {
		const list = read(guestKey(), []);
		a.id = 'a' + Date.now();
		list.push(a);
		write(guestKey(), list);
		setAddress(a.id);
		return a;
	}
	const id = addrMuts.create ? await addrMuts.create(argsFor(a)) : null;
	if (id == null) throw new Error('address save unavailable');
	const row = { ...a, id: String(id), _id: id, deliverable: true, isDefault: backendCache.length === 0 };
	// The live query can land before this mutation resolves: don't list the row twice
	// (duplicate keys in the checkout address list crash the page).
	if (!backendCache.some((r) => r.id === row.id)) backendCache = backendCache.concat([row]);
	setAddress(row.id);
	return existing ?? row;
}

/**
 * Edit in place, keeping the id and the current selection. Backend rows save
 * through the backend; design-check seeds and older locally added addresses
 * keep the local write. Throws (and changes nothing) when the save fails.
 * @param {string} id
 * @param {any} patch
 */
export async function updateAddress(id, patch) {
	const list = read(guestKey(), []);
	const i = list.findIndex((a) => a.id === id);
	if (i >= 0) {
		list[i] = { ...list[i], ...patch, id: list[i].id };
		write(guestKey(), list);
		return list[i];
	}
	const row = backendCache.find((a) => a.id === id);
	if (row?._id && addrMuts.update) {
		await addrMuts.update({ addressId: row._id, ...argsFor(patch) });
		backendCache = backendCache.map((a) => (a.id === id ? { ...a, ...patch, id, _id: a._id } : a));
		return backendCache.find((a) => a.id === id);
	}
	const edits = read('addressEdits', {});
	edits[id] = { ...(edits[id] || {}), ...patch };
	write('addressEdits', edits);
	return allAddresses().find((a) => a.id === id);
}

/**
 * Delete a saved address. Backend rows delete through the backend (which
 * promotes another default); local rows are just dropped. If it was the
 * selected address the selection moves to the first one left.
 * Throws (and changes nothing) when the backend delete fails.
 * @param {string} id
 */
export async function removeAddress(id) {
	const wasSelected = addressId() === id;
	const row = backendCache.find((a) => a.id === id);
	if (row?._id && addrMuts.delete) {
		await addrMuts.delete({ addressId: row._id });
		backendCache = backendCache.filter((a) => a.id !== id);
	} else {
		write(guestKey(), read(guestKey(), []).filter((/** @type {any} */ a) => a.id !== id));
	}
	if (wasSelected) setAddress(allAddresses().find((a) => a.id !== id)?.id ?? '');
}
