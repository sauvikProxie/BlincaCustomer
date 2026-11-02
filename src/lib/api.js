/* Blinca – backend API seam.
   Real mode (default): maps Convex public storefront reads into the source
   SiteData shape via the existing serverClient (works SSR + browser).
   Design-check (VITE_DESIGN_CHECK=1, dev only): returns the source DATA
   verbatim so Playwright pixel-diffs stay identical with no backend. */
import { DATA } from './data.js';
import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$app/env/public';
import { api } from '@blinca/backend/convex/_generated/api';
import { fromPrice, variantGroup } from './variants.js';

/** Real mode is the default; design-check only when explicitly 1/true. */
export function isDesignCheck() {
	// DEV guard: in a production build this folds to false, so the flag cannot enable mock mode.
	if (!import.meta.env.DEV) return false;
	const v = import.meta.env.VITE_DESIGN_CHECK;
	return v === '1' || v === 1 || v === true || v === 'true';
}

/** Back-compat: true in design-check, false in real mode (default). */
export const USE_MOCK = isDesignCheck();

/** @param {number} min */
function fmtHM(min) {
	if (!Number.isFinite(min)) return '00:00';
	const m = ((Math.round(min) % 1440) + 1440) % 1440;
	return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/** Backend weekly hours → source hours: 7 entries Mon..Sun, each [open,close]
 *  or null when that day is closed.
 *  @param {any[]|undefined} weekly @returns {Array<string[]|null>} */
export function mapHours(weekly) {
	const out = [];
	for (let d = 0; d < 7; d++) {
		const r = (weekly || []).find((x) => x.dayOfWeek === d);
		if (!r) {
			// No row means closed: the backend drops `isClosed` rows, so a
			// missing day is exactly what "closed" looks like.
			out.push(null);
		} else if (r.openMinutes === 0 && r.closeMinutes >= 1440) {
			// Open around the clock: the one case '00:00'–'00:00' means 24/7.
			out.push(['00:00', '00:00']);
		} else {
			out.push([fmtHM(r.openMinutes), fmtHM(r.closeMinutes >= 1440 ? 0 : r.closeMinutes)]);
		}
	}
	return out;
}

/** Backend special days → source shape: one entry per date, `ranges` empty
 *  when the date is closed.
 *  @param {any[]|undefined} specialDays @returns {{ date: string, ranges: string[][] }[]} */
export function mapSpecialDays(specialDays) {
	return (specialDays || []).map((d) => ({
		date: d.date,
		ranges: (d.ranges || []).map((r) => [
			fmtHM(r.openMinutes),
			fmtHM(r.closeMinutes >= 1440 ? 0 : r.closeMinutes)
		])
	}));
}

/** Backend status.kind → source status string. */
function mapStatusKind(kind) {
	if (kind === 'open') return 'open';
	if (kind === 'closed') return 'closed';
	if (kind === 'paused_short' || kind === 'paused_long') return 'paused';
	return 'closed';
}

/** @param {number} ts */
function fmtStockholmHM(ts) {
	if (!Number.isFinite(ts)) return '00:00';
	try {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Europe/Stockholm',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		}).format(new Date(ts));
	} catch {
		const d = new Date(ts);
		return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
	}
}

/** @param {any} opt */
function mapChoice(opt) {
	return {
		id: String(opt._id),
		name: { en: opt.nameEn || opt.name, sv: opt.name },
		price: (opt.priceCents ?? 0) / 100
	};
}

/** @param {any} g */
function mapGroup(g) {
	return {
		id: String(g._id),
		name: { en: g.nameEn || g.name, sv: g.name },
		min: g.minSelections ?? 0,
		max: g.maxSelections ?? 0,
		choices: (g.options || []).map(mapChoice)
	};
}

/** @param {any} it */
export function mapDish(it) {
	const sizes = variantGroup(it.variants);
	// The lightweight list (home, search) has no sizes, only hasVariants + the cheapest price.
	const lite = !sizes && it.hasVariants;
	return {
		id: String(it._id),
		name: { en: it.nameEn || it.name, sv: it.name },
		desc: { en: it.descriptionEn || it.description || '', sv: it.description || '' },
		price: sizes
			? fromPrice(it.variants)
			: lite
				? (it.fromPriceCents ?? it.priceCents ?? 0) / 100
				: (it.priceCents ?? 0) / 100,
		...(sizes || lite ? { from: true } : {}),
		tags: [
			...((it.dietaryTags || []).includes('vegan') || (it.dietaryTags || []).includes('vegetarian')
				? ['vegetarian']
				: []),
			...((it.dietaryTags || []).includes('spicy') ? ['spicy'] : [])
		],
		options: [...(sizes ? [sizes] : []), ...(it.optionGroups || []).map(mapGroup)],
		// null = the restaurant has not declared allergens (shown as "ask them").
		allergens: Array.isArray(it.allergens) ? it.allergens : null,
		image: it.imageUrl || null,
		// Live availability for follow-up UI states (sold-out/disabled reasoning).
		// The transplanted markup does not read these yet (documented gap).
		availability: it.availability || { kind: 'available' },
		soldOut: (it.availability?.kind ?? 'available') !== 'available'
	};
}

/** @param {any} cat */
function mapCat(cat) {
	return {
		id: String(cat._id),
		name: { en: cat.nameEn || cat.name, sv: cat.name },
		items: (cat.items || []).map(mapDish)
	};
}

/** One listed restaurant → the source shape (detail + menu). Null when the
 *  slug is not public (unknown or deactivated).
 *  @param {ConvexHttpClient} client @param {any} card @returns {Promise<any>} */
async function mapRestaurant(client, card, prefetched) {
	const detail = prefetched ?? (await client.query(api.customer.restaurants.getBySlug, { slug: card.slug }));
	if (!detail) return null;
	const menu = await client.query(api.customer.menu.getForRestaurant, {
		restaurantId: card._id
	});
	return mapRestaurantData(card, detail, menu);
}

/** The pure half of `mapRestaurant`: card + detail + menu → the source shape. Also used by the
 *  live subscriptions on the restaurant page.
 *  @param {any} card @param {any} detail @param {any} menu */
export function mapRestaurantData(card, detail, menu) {
	const cats = (menu.categories || []).map(mapCat);
	// Öre are kept: cart totals (pricing()) are öre-exact, so rounding here
	// would drift the menu and the minimum-order check by up to one krona.
	const fee = (card.deliveryFee?.minCents ?? 0) / 100;
	const eta = card.deliveryMinutes ?? detail.deliveryMinutes ?? 30;
	const pickupEta = detail.prepTimeMinutes ?? eta;
	const veg =
		(detail.cuisines || []).some((c) => c === 'vegan' || c === 'healthy') ||
		cats.some((c) => c.items.some((i) => (i.tags || []).includes('vegetarian')));
	const hours = mapHours(detail.hours?.weekly);
	// No next opening from the backend: show the first day that has hours.
	const firstOpen = hours.find((h) => h !== null) || ['00:00', '00:00'];
	return {
		slug: card.slug,
		name: card.name,
		listed: true,
		cuisines: card.cuisines || [],
		priceLevel: card.priceLevel ?? 2,
		rating: card.ratingAverage ?? 0,
		reviews: card.ratingCount ?? 0,
		fee,
		eta,
		pickupEta,
		veg,
		status: mapStatusKind(card.status?.kind),
		closesAt: detail.closesAt != null ? fmtStockholmHM(detail.closesAt) : firstOpen[1],
		opensAt: detail.opensAt != null ? fmtStockholmHM(detail.opensAt) : firstOpen[0],
		address: detail.address || '',
		postalCode: detail.postalCode || '',
		city: detail.city || '',
		hours,
		specialDays: mapSpecialDays(detail.hours?.specialDays),
		image: card.imageUrl || detail.imageUrl || null,
		minOrder: (card.minOrderCents ?? detail.minOrderCents ?? 0) / 100,
		km: undefined,
		// Up to three photographed, orderable dishes lead the menu as "Popular"
		// (no sales ranking yet, so the photo is the restaurant's own highlight).
		popular: cats
			.flatMap((c) => c.items)
			.filter((i) => i.image && !i.soldOut)
			.slice(0, 3)
			.map((i) => i.id),
		desc: { en: detail.descriptionEn || detail.description || '', sv: detail.description || '' },
		menu: cats,
		_restaurantId: String(card._id)
	};
}

/** Card-level restaurant (list query only): enough for the grid, headers and
 *  search. Hours, address and the full menu arrive with `loadRestaurantFull`;
 *  `menu` holds lightweight dishes until then (`_lite`).
 *  @param {any} card @param {any[]} dishes */
function mapCard(card, dishes) {
	const open = card.status?.kind === 'open';
	const at = card.nextChangeAt != null ? fmtStockholmHM(card.nextChangeAt) : '00:00';
	const items = dishes.map(mapDish);
	const fee = (card.deliveryFee?.minCents ?? 0) / 100;
	const eta = card.deliveryMinutes ?? 30;
	return {
		slug: card.slug,
		name: card.name,
		listed: true,
		cuisines: card.cuisines || [],
		priceLevel: card.priceLevel ?? 2,
		rating: card.ratingAverage ?? 0,
		reviews: card.ratingCount ?? 0,
		fee,
		eta,
		pickupEta: eta,
		veg:
			(card.cuisines || []).some((/** @type {string} */ c) => c === 'vegan' || c === 'healthy') ||
			items.some((i) => (i.tags || []).includes('vegetarian')),
		status: mapStatusKind(card.status?.kind),
		closesAt: open ? at : '00:00',
		opensAt: open ? '00:00' : at,
		address: '',
		postalCode: '',
		city: card.city || '',
		hours: Array(7).fill(null),
		specialDays: [],
		image: card.imageUrl || null,
		minOrder: (card.minOrderCents ?? 0) / 100,
		km: undefined,
		popular: undefined,
		menu: items.length ? [{ id: 'all', name: { en: 'Menu', sv: 'Meny' }, items }] : [],
		_restaurantId: String(card._id),
		_card: card,
		_lite: true
	};
}

/** Full detail + menu for one restaurant (null when no longer public).
 *  @param {any} card */
export function loadRestaurantFull(card) {
	return mapRestaurant(new ConvexHttpClient(PUBLIC_CONVEX_URL), card);
}

/** The restaurant page's live data (`getBySlug` + `getForRestaurant` results) in the source shape.
 *  @param {any} detail @param {any} menu */
export function mapLiveRestaurant(detail, menu) {
	const fees = (detail.deliveryZones || []).map((/** @type {any} */ z) => z.deliveryFeeCents);
	const card = { ...detail, deliveryFee: { minCents: fees.length ? Math.min(...fees) : 0 } };
	return mapRestaurantData(card, detail, menu);
}

/** A restaurant that is not in the (capped) list, by slug: `getBySlug` is the card,
 *  its cheapest zone the fee. Null only when getBySlug returns nothing.
 *  @param {string} slug @returns {Promise<any>} */
export async function loadRestaurantBySlug(slug) {
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	const detail = await client.query(api.customer.restaurants.getBySlug, { slug });
	if (!detail) return null;
	const fees = (detail.deliveryZones || []).map((/** @type {any} */ z) => z.deliveryFeeCents);
	const card = { ...detail, deliveryFee: { minCents: fees.length ? Math.min(...fees) : 0 } };
	return mapRestaurant(client, card, detail);
}

/** @returns {Promise<any>} */
export async function loadSiteData() {
	if (isDesignCheck()) return DATA;
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	// Real mode has no demo data to hide behind: a failed list throws so the
	// route renders its error state instead of restaurants that are not on the platform.
	const [res, dishes] = await Promise.all([
		client.query(api.customer.restaurants.list, {}).catch((e) => {
			console.error('[api] Convex restaurant list failed', e);
			throw e;
		}),
		// Dishes only feed the home sections and search; the page works without them.
		client.query(api.customer.menu.listDishes, {}).catch((e) => {
			console.error('[api] Convex dish list failed', e);
			return [];
		})
	]);
	/** @type {Map<string, any[]>} */
	const byRestaurant = new Map();
	for (const d of dishes) {
		const k = String(d.restaurantId);
		byRestaurant.set(k, [...(byRestaurant.get(k) || []), d]);
	}
	const restaurants = (res.restaurants || []).map((/** @type {any} */ c) =>
		mapCard(c, byRestaurant.get(String(c._id)) || [])
	);

	// Home highlights: dishes with a photo first, at most one per restaurant,
	// best-rated open kitchens first, so the lists read like a real city.
	const ranked = [...restaurants].sort(
		(a, b) => (b.status === 'open' ? 1 : 0) - (a.status === 'open' ? 1 : 0) || b.rating - a.rating
	);
	/** @type {Array<[string, string]>} */
	const picks = [];
	for (const pass of [true, false]) {
		for (const r of ranked) {
			if (picks.some(([slug]) => slug === r.slug)) continue;
			const it = r.menu.flatMap((/** @type {any} */ c) => c.items).find((/** @type {any} */ i) => !pass || i.image);
			if (it) picks.push([r.slug, it.id]);
		}
	}
	const popular = picks.slice(0, 7);
	const trending = picks.slice(0, 5).map(([slug, id], i) => [slug, id, 10 + i * 3]);

	return {
		images: DATA.images,
		cuisines: DATA.cuisines,
		restaurants,
		addresses: [],
		heroSlides: DATA.heroSlides,
		offers: [],
		popular,
		trending,
		moods: DATA.moods,
		seed: { address: '', favorites: [], cart: [], orders: [] },
		vatRate: DATA.vatRate
	};
}

/** Synchronous access to the mock dataset (prerender + first paint). */
export function getMockData() {
	return DATA;
}
