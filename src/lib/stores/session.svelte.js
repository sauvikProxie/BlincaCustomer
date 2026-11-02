/* Blinca – real-mode session + Convex wiring cache.
   Design-check: unused (engines use DATA/localStorage verbatim).
   Real mode: (app)/+layout.svelte registers the Better Auth client + Convex
   URL once, then pushes session/user/phone updates here. Other engines read
   isLoggedIn()/sessionUser() synchronously so their sync getters keep working
   while staying empty when logged out (fixes pill-after-logout). */
import { browser } from '#app/env';

function isDesign() {
	// DEV guard: in a production build this folds to false, so the flag cannot enable mock mode.
	if (!import.meta.env.DEV) return false;
	try {
		const v = import.meta.env.VITE_DESIGN_CHECK;
		return v === '1' || v === 1 || v === true || v === 'true';
	} catch {
		return false;
	}
}

export function isDesignCheck() {
	return isDesign();
}

/** Reactive session user (undefined = loading, null = signed out). */
let sessionUserState = $state(undefined);
/** Reactive phone from customers.getMe. */
let sessionPhone = $state(null);

/** @type {{ authClient: any, convexUrl: string|null }} non-reactive wiring (set once). */
export const sessionCache = {
	authClient: null,
	get sessionUser() {
		return sessionUserState;
	},
	get phone() {
		return sessionPhone;
	},
	convexUrl: null
};

/** @param {any} c */
export function setAuthClient(c) {
	sessionCache.authClient = c || null;
}

/** @param {string|null} url */
export function setConvexUrl(url) {
	sessionCache.convexUrl = url || null;
}

/** @param {any} u @param {string|null} phone */
export function setSession(u, phone) {
	sessionUserState = u || null;
	sessionPhone = phone ?? null;
}

export function clearSession() {
	sessionUserState = null;
	sessionPhone = null;
}

/** Sync logged-in check for engines (design-check always "logged in" via seed). */
export function isLoggedIn() {
	if (isDesign()) return true;
	return !!sessionUserState;
}

/** @returns {any|null} raw session user or null */
export function sessionUser() {
	if (isDesign()) return null;
	return sessionUserState ?? null;
}

/** Sign out via Better Auth (real mode only). */
export async function signOutReal() {
	const c = sessionCache.authClient;
	if (c?.signOut) {
		try {
			await c.signOut();
		} catch (e) {
			console.warn('[session] signOut failed', e);
		}
	}
	clearSession();
	if (browser) {
		try {
			const { goto } = await import('#app/navigation');
			await goto('/');
		} catch {
			window.location.href = '/';
		}
	}
}
