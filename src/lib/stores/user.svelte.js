/* Blinca – session store.
   Design-check: localStorage fake user verbatim (source behaviour).
   Real mode: Better Auth session (+ customers.getMe phone) via session cache.
   setUser(null) = sign out + clear + back to /. Fake setUser({...}) in real
   mode is ignored (real login goes through authClient.signIn/signUp); real
   profile edits go through saveProfile(). */
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@blinca/backend/convex/_generated/api';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { read, write } from './core.svelte.js';
import { isDesignCheck, sessionUser, sessionCache, signOutReal } from './session.svelte.js';

/** @returns {import('#lib/types.js').User|null} */
export function user() {
	if (isDesignCheck()) return read('user', null);
	const u = sessionUser();
	if (!u) return null;
	const phone = sessionCache.phone ?? '';
	return { name: u.name || u.email || '', email: u.email || '', phone };
}

/** @param {{ name: string, email: string, phone: string } | null} u */
export function setUser(u) {
	if (isDesignCheck()) {
		write('user', u || null);
		return;
	}
	if (u == null) {
		void signOutReal();
		return;
	}
	console.warn('[user] setUser(fake) ignored in real mode — use authClient.signIn/signUp');
}

/**
 * Save profile edits in real mode. Better Auth owns name/email (update-user
 * has no email change, so the dialog blocks that); the customers row mirrors
 * the name and stores the phone — getMe live-updates the session cache.
 * @param {{ name: string, phone: string }} u
 * @returns {Promise<boolean>} true when everything saved.
 */
export async function saveProfile(u) {
	if (isDesignCheck()) return false;
	const client = sessionCache.authClient;
	if (!client) return false;
	try {
		const { error } = await client.updateUser({ name: u.name });
		if (error) return false;
		// Re-pull the session so the new name renders everywhere immediately.
		try {
			client.$store?.notify?.('$sessionSignal');
		} catch {}
		const res = await client.convex?.token({ fetchOptions: { throw: false } });
		const token = res?.data?.token ?? null;
		if (!token) return false;
		const http = new ConvexHttpClient(PUBLIC_CONVEX_URL);
		http.setAuth(token);
		await http.mutation(api.customers.updateProfile, { name: u.name, phone: u.phone });
		return true;
	} catch (e) {
		console.warn('[user] saveProfile failed', e);
		return false;
	}
}
