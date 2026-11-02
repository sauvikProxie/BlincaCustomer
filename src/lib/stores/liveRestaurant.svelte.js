/* Keeps one restaurant in the catalog store live while its page is open: the restaurant (hours,
   status, pause) and its menu (stock, prices) are subscribed with useQuery and written into the
   store, which everything on the page already reads. The one-off loads (ensureMenu,
   ensureRestaurant) stay as the first paint and as the fallback for restaurants outside the home list.
   Convex queries do not re-run when the clock passes an opening or closing time, so a timer at
   `nextChangeAt` fetches the restaurant once more. */
import { ConvexHttpClient } from 'convex/browser';
import { useQuery } from 'convex-svelte';
import { api } from '@blinca/backend/convex/_generated/api';
import { browser } from '#app/env';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { mapLiveRestaurant } from '#lib/api.js';
import { setLiveRestaurant } from '#lib/stores/catalog.svelte.js';
import { isDesignCheck } from '#lib/stores/session.svelte.js';

const MAX_TIMEOUT = 2 ** 31 - 1;

/** Call once from a component's script. @param {() => string} getSlug */
export function useLiveRestaurant(getSlug) {
	if (!browser || isDesignCheck()) return;
	const detail = useQuery(api.customer.restaurants.getBySlug, () => ({ slug: getSlug() }));
	const menu = useQuery(api.customer.menu.getForRestaurant, () =>
		detail.data ? { restaurantId: detail.data._id } : 'skip'
	);
	// A fresher read from the timer; any newer push from the subscription replaces it.
	/** @type {typeof detail.data} */
	let fetched = $state(null);
	$effect(() => {
		detail.data;
		fetched = null;
	});
	const live = $derived(fetched ?? detail.data);

	$effect(() => {
		if (live && menu.data) setLiveRestaurant(live.slug, mapLiveRestaurant(live, menu.data));
	});

	$effect(() => {
		const at = live?.nextChangeAt;
		if (at == null) return;
		const id = setTimeout(
			async () => {
				try {
					const fresh = await new ConvexHttpClient(PUBLIC_CONVEX_URL).query(
						api.customer.restaurants.getBySlug,
						{ slug: getSlug() }
					);
					if (fresh) fetched = fresh;
				} catch (e) {
					console.warn('[live] restaurant refresh failed', e);
				}
			},
			Math.min(Math.max(at - Date.now(), 0) + 1000, MAX_TIMEOUT)
		);
		return () => clearTimeout(id);
	});
}
