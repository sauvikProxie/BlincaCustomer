// Thin typed wrappers over the public storefront queries. Server-side load
// functions (+page.server.ts) use a one-off Convex HTTP client; the query
// references are re-exported for `useQuery` on the client. No UI here.
//
// Types are inferred straight from the backend functions, so the discriminated
// `status` / `availability` unions flow through without a second declaration.
import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { api } from '@blinca/backend/convex/_generated/api';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';

/** The public query references, for `useQuery(catalog.listRestaurants, …)`. */
export const catalog = {
	listRestaurants: api.customer.restaurants.list,
	getRestaurant: api.customer.restaurants.getBySlug,
	getMenu: api.customer.menu.getForRestaurant,
	getMenuItem: api.customer.menu.getItem
} as const;

/** The customer cart functions, for `useQuery(cartApi.get, …)` / `useMutation`. */
export const cartApi = {
	get: api.customer.cart.get,
	addItem: api.customer.cart.addItem,
	setQuantity: api.customer.cart.setQuantity,
	setNote: api.customer.cart.setNote,
	removeItem: api.customer.cart.removeItem,
	clear: api.customer.cart.clear,
	setFulfillment: api.customer.cart.setFulfillment
} as const;

/** Checkout preview/place plus the owner order read for the pay stub. */
export const checkoutApi = {
	preview: api.customer.checkout.preview,
	placeOrder: api.customer.checkout.placeOrder
} as const;

export const ordersApi = {
	getMine: api.customer.orders.getMine
} as const;

/** Mollie payment flow: start/resume a payment, re-sync from Mollie, live status. */
export const paymentsApi = {
	start: api.customer.payments.start,
	sync: api.customer.payments.sync,
	getStatus: api.customer.payments.getStatus
} as const;

export type PaymentStatus = FunctionReturnType<typeof api.customer.payments.getStatus>;

/** Saved addresses and the signed-in profile (phone prefill). */
export const customerApi = {
	listAddresses: api.marketplace.listMyAddresses,
	createAddress: api.marketplace.createMyAddress,
	updateAddress: api.marketplace.updateMyAddress,
	deleteAddress: api.marketplace.deleteMyAddress,
	getMe: api.customers.getMe
} as const;

export type CartView = FunctionReturnType<typeof api.customer.cart.get>;
export type CartLine = NonNullable<CartView>['lines'][number];
export type CartIssue = NonNullable<CartView>['issues'][number];
export type CheckoutPreview = FunctionReturnType<typeof api.customer.checkout.preview>;
export type MyOrder = FunctionReturnType<typeof api.customer.orders.getMine>;

export type RestaurantListArgs = FunctionArgs<typeof api.customer.restaurants.list>;
export type RestaurantListResult = FunctionReturnType<typeof api.customer.restaurants.list>;
export type RestaurantCard = RestaurantListResult['restaurants'][number];
export type RestaurantDetail = FunctionReturnType<typeof api.customer.restaurants.getBySlug>;
/** `getBySlug` without the null (returned for unknown/inactive slugs). */
export type RestaurantDetailData = NonNullable<RestaurantDetail>;
export type RestaurantMenu = FunctionReturnType<typeof api.customer.menu.getForRestaurant>;
export type MenuItemDetail = FunctionReturnType<typeof api.customer.menu.getItem>;
export type MenuCategory = RestaurantMenu['categories'][number];
export type MenuItem = MenuCategory['items'][number];
/** The restaurant `status` discriminated union, inferred from the query. */
export type RestaurantStatus = RestaurantCard['status'];
/** The per-item `availability` discriminated union, inferred from the query. */
export type ItemAvailability = MenuItem['availability'];

function serverClient(): ConvexHttpClient {
	return new ConvexHttpClient(PUBLIC_CONVEX_URL);
}

/** Server-side load (public data, so no auth token is attached). */
export async function loadRestaurants(
	args: RestaurantListArgs = {}
): Promise<RestaurantListResult> {
	return await serverClient().query(api.customer.restaurants.list, args);
}

export async function loadRestaurant(slug: string): Promise<RestaurantDetail> {
	return await serverClient().query(api.customer.restaurants.getBySlug, { slug });
}

export async function loadMenu(
	restaurantId: FunctionArgs<typeof api.customer.menu.getForRestaurant>['restaurantId']
): Promise<RestaurantMenu> {
	return await serverClient().query(api.customer.menu.getForRestaurant, { restaurantId });
}

export async function loadMenuItem(
	itemId: FunctionArgs<typeof api.customer.menu.getItem>['itemId']
): Promise<MenuItemDetail> {
	return await serverClient().query(api.customer.menu.getItem, { itemId });
}
