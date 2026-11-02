<script>
	// Transplant: the source +layout.svelte chrome, wrapping every (app) page.
	// Route detection uses page.url.pathname (not route.id) so it works through
	// the customer's route groups. Data engines feed it (DATA in design-check,
	// Convex in real mode — the root subscription layer lives here too).
	import { browser } from '#app/env';
	import { onMount } from 'svelte';
	import { page } from '#app/state';
	import { goto } from '#app/navigation';
	import { PUBLIC_CONVEX_URL } from '$app/env/public';
	import { useQuery, useMutation, useAuth } from 'convex-svelte';
	import { createPlatformAuth } from '@blinca/auth';
	import { cartApi, customerApi } from '#lib/services/catalog.js';
	import { api } from '@blinca/backend/convex/_generated/api';
	import { isCheckoutPath, isTrackPath } from '#lib/routes.js';
	import Header from '#lib/components/Header.svelte';
	import DesktopHeader from '#lib/components/desktop/DesktopHeader.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import TabBar from '#lib/components/TabBar.svelte';
	import OfflineBanner from '#lib/components/OfflineBanner.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import LayerHost from '#lib/components/LayerHost.svelte';
	import OfferPopup from '#lib/components/OfferPopup.svelte';
	import TrackPill from '#lib/components/track/TrackPill.svelte';
	import { closeAll, toast } from '#lib/layers.svelte.js';
	import { lang, t, tOptional } from '#lib/stores/language.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { seedIfNeeded, attachTabSync } from '#lib/stores/core.svelte.js';
	import { getSiteData, keyFor, normOpts, ensureMenu } from '#lib/stores/catalog.svelte.js';
	import { orders, setOrdersCache, setOrdersFeed } from '#lib/stores/orders.svelte.js';
	import { activeTrackings, track, setTimelineMap } from '#lib/stores/tracking.svelte.js';
	import { changedStatuses } from '#lib/order/status.js';
	import { setCartCache, setCartMutations, replayPendingCart } from '#lib/stores/cart.svelte.js';
	import { setAddressCache, setAddressMutations } from '#lib/stores/address.svelte.js';
	import { setFavoritesCache, setFavoriteMutation } from '#lib/stores/favourites.svelte.js';
	import { setOffersCache } from '#lib/stores/offers.svelte.js';
	import {
		isDesignCheck,
		setAuthClient,
		setConvexUrl,
		setSession,
		clearSession
	} from '#lib/stores/session.svelte.js';

	const DESIGN = isDesignCheck();
	// Auth + Convex provider (browser only inside; SSR returns null convex).
	const platformAuth = createPlatformAuth({ convexUrl: PUBLIC_CONVEX_URL });
	if (browser && !DESIGN) {
		setAuthClient(platformAuth.authClient);
		setConvexUrl(PUBLIC_CONVEX_URL);
	}
	const auth = browser && !DESIGN ? useAuth() : null;
	const authed = () => !DESIGN && browser && !!auth?.isAuthenticated;

	// Live subscriptions (skip when design-check / logged out; engines fall back).
	const meQuery =
		browser && !DESIGN ? useQuery(customerApi.getMe, () => (authed() ? {} : 'skip')) : null;
	const cartQuery =
		browser && !DESIGN ? useQuery(cartApi.get, () => (authed() ? {} : 'skip')) : null;
	const addrQuery =
		browser && !DESIGN ? useQuery(customerApi.listAddresses, () => (authed() ? {} : 'skip')) : null;
	const favQuery =
		browser && !DESIGN
			? useQuery(api.favorites.listMyFavorites, () => (authed() ? {} : 'skip'))
			: null;
	const recentQuery =
		browser && !DESIGN
			? useQuery(api.customer.orders.listRecentOrders, () => (authed() ? {} : 'skip'))
			: null;
	const activeQuery =
		browser && !DESIGN
			? useQuery(api.customer.orders.listActiveOrders, () => (authed() ? {} : 'skip'))
			: null;
	const promosQuery = browser && !DESIGN ? useQuery(api.marketplace.listPublicOffers, {}) : null;

	const addItemMut = browser && !DESIGN ? useMutation(cartApi.addItem) : null;
	const setQtyMut = browser && !DESIGN ? useMutation(cartApi.setQuantity) : null;
	const removeMut = browser && !DESIGN ? useMutation(cartApi.removeItem) : null;
	const clearMut = browser && !DESIGN ? useMutation(cartApi.clear) : null;
	const toggleFavMut = browser && !DESIGN ? useMutation(api.favorites.toggleFavorite) : null;
	const createAddrMut = browser && !DESIGN ? useMutation(customerApi.createAddress) : null;
	const updateAddrMut = browser && !DESIGN ? useMutation(customerApi.updateAddress) : null;
	const deleteAddrMut = browser && !DESIGN ? useMutation(customerApi.deleteAddress) : null;
	if (browser && !DESIGN) {
		setCartMutations({
			addItem: addItemMut,
			setQuantity: setQtyMut,
			removeItem: removeMut,
			clear: clearMut
		});
		setFavoriteMutation(toggleFavMut);
		setAddressMutations({ create: createAddrMut, update: updateAddrMut, delete: deleteAddrMut });
	}

	// Push session → user engine (name/email + phone from getMe).
	$effect(() => {
		if (DESIGN || !browser) return;
		const s = platformAuth.session.current;
		if (s === undefined) return;
		if (!s?.session) {
			clearSession();
			setCartCache(null);
			setOrdersCache([], () => '');
			setAddressCache([]);
			setFavoritesCache([]);
			setTimelineMap({});
			return;
		}
		setSession(s.user, meQuery?.data?.phone ?? null);
	});
	$effect(() => {
		if (DESIGN || !browser) return;
		if (cartQuery?.data !== undefined) setCartCache(cartQuery.data);
		// Cart lines resolve through the full menu, which the grid does not load.
		const cartSlug = cartQuery?.data?.restaurant?.slug;
		if (cartSlug) void ensureMenu(cartSlug);
	});
	$effect(() => {
		if (DESIGN || !browser) return;
		if (addrQuery?.data !== undefined) setAddressCache(addrQuery.data);
	});
	$effect(() => {
		if (DESIGN || !browser) return;
		if (favQuery?.data !== undefined) setFavoritesCache(favQuery.data);
	});
	$effect(() => {
		if (DESIGN || !browser) return;
		setOrdersFeed(
			!!(recentQuery?.isLoading || activeQuery?.isLoading),
			!!(recentQuery?.error || activeQuery?.error)
		);
	});
	$effect(() => {
		if (DESIGN || !browser) return;
		const recent = recentQuery?.data ?? [];
		const active = activeQuery?.data ?? [];
		/** @type {Record<string, any>} */
		const byId = {};
		for (const o of [...active, ...recent]) byId[String(o._id)] = o;
		const map = getSiteData();
		const slugFor = (/** @type {string} */ id) => {
			const r = (map.restaurants || []).find((x) => x._restaurantId === id);
			return r ? r.slug : '';
		};
		setOrdersCache(Object.values(byId), slugFor);
		// Receipts and tracking read the restaurant's address and hours.
		for (const o of Object.values(byId)) {
			const s = slugFor(String(o.restaurantId));
			if (s) void ensureMenu(s);
		}
	});
	$effect(() => {
		if (DESIGN || !browser) return;
		if (promosQuery?.data !== undefined) setOffersCache(promosQuery.data);
	});
	// Replay a logged-out pending add once after sign-in.
	$effect(() => {
		if (DESIGN || !browser) return;
		if (authed()) void replayPendingCart();
	});

	/** @type {{ children: import('svelte').Snippet }} */
	let { children } = $props();

	const path = $derived(page.url.pathname);
	const tab = $derived(browser ? page.url.searchParams.get('tab') : null);

	const isHome = $derived(path === '/');
	const isRestaurant = $derived(path.startsWith('/restaurants/'));
	const isCheckout = $derived(isCheckoutPath(path));
	const isLogin = $derived(path === '/login' || path === '/signup' || path === '/forgot-password');
	const isAccount = $derived(path === '/account');
	const isTrack = $derived(isTrackPath(path));
	const isInfo = $derived(
		['/search', '/help', '/privacy', '/terms', '/om-oss', '/sa-fungerar-det', '/kontakt'].includes(
			path
		) || path.startsWith('/info/')
	);

	const pageName = $derived.by(() => {
		if (isHome) return 'home';
		if (isRestaurant) return 'restaurant';
		if (isCheckout) return 'checkout';
		if (isLogin) return 'login';
		if (isAccount) return tab === 'orders' ? 'orders' : 'account';
		if (isInfo) return 'info';
		if (isTrack) return 'track';
		return 'error';
	});
	const footerKind = $derived(
		isCheckout || isLogin || pageName === 'error' || isTrack ? 'min' : 'dark'
	);
	const showTabbar = $derived(!isLogin && !isTrack);
	const tabActive = $derived(
		isHome ? 'home' : isAccount ? (tab === 'orders' ? 'orders' : 'account') : ''
	);

	$effect(() => {
		if (browser) document.body.setAttribute('data-page', pageName);
	});

	let lastPath = $state('');
	$effect(() => {
		if (!browser) return;
		const p = page.url.pathname;
		if (lastPath && p !== lastPath) closeAll();
		lastPath = p;
	});

	onMount(() => {
		seedIfNeeded(getSiteData, keyFor, normOpts);
		attachTabSync();
		document.documentElement.lang = lang();
	});

	/** @type {Record<string, string>} */
	let lastStatus = {};
	let statusReady = false;
	$effect(() => {
		if (!browser) return;
		/* Real mode watches every order: a delivered/collected one has left the active
		   list by the time its status flips, and still deserves its one toast. */
		const watched = isDesignCheck() ? activeTrackings(orders()) : orders();
		const entries = watched.map((o) => {
			const tr = track(o);
			return { id: o.id, status: tr.status, cancelled: tr.cancelled };
		});
		for (const { id, status } of changedStatuses(lastStatus, entries, statusReady)) {
			if (isTrack) continue;
			const msg = tOptional('track.toast.' + status);
			if (msg)
				toast(msg, {
					label: t('track.track'),
					onClick: () => goto('/orders/' + encodeURIComponent(id))
				});
		}
		statusReady = true;
	});
</script>

<a class="skip-link" href="#app">{m.site_skip_to_content()}</a>
<OfflineBanner />
{#if !isTrack && !isLogin}<Header />{/if}
{#if !isLogin}<DesktopHeader />{/if}
<main id="app" tabindex="-1">
	{@render children()}
</main>
<Footer kind={footerKind} />
{#if showTabbar}<TabBar active={tabActive} />{/if}
<Toast />
<LayerHost />
<OfferPopup />
<!-- Source TrackPill self-hides on track/checkout via route.id; under the
     customer route groups route.id differs, so gate it here to match. -->
{#if !isTrack && !isCheckout}<TrackPill />{/if}
