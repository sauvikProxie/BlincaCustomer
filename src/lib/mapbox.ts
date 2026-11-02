/**
 * Mapbox browser helpers shared by the address picker and the order-tracking map.
 *
 * Nothing here imports `mapbox-gl` at module scope: the library (and its
 * stylesheet) is loaded lazily from the map components' `onMount`, so SSR never
 * touches `window` and the marketing pages never load it. Every call degrades to
 * `null`/`''` when the token is missing or the request fails, so callers keep
 * working with a plain address form or the faux tracking map.
 */
import { PUBLIC_MAPBOX_ACCESS_TOKEN } from '$app/env/public';

/** Default public token; empty string when `.env` has none (maps are then off). */
export const MAPBOX_TOKEN: string = PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

/** Fallback view when there is nothing to geocode yet: Stockholm. */
export const STOCKHOLM: LngLat = [18.0686, 59.3293];

export type LngLat = [number, number];
/** The bits of a geocoding result the address form's three fields expect. */
export type Place = { center: LngLat; street: string; zip: string; city: string };
export type Route = { coordinates: LngLat[]; seconds: number };

/** `mapbox-gl` plus its stylesheet, lazily. Browser only. */
export async function loadMapbox() {
	const [mod] = await Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')]);
	const mapboxgl = mod.default;
	mapboxgl.accessToken = MAPBOX_TOKEN;
	return mapboxgl;
}

/** The lazily-loaded `mapbox-gl` namespace, and the instance types components hold. */
export type Mapbox = Awaited<ReturnType<typeof loadMapbox>>;
export type MapboxMap = InstanceType<Mapbox['Map']>;
export type MapboxMarker = InstanceType<Mapbox['Marker']>;

/** The app's brand token, so route paint matches the rest of the UI. */
export function brandColor(): string {
	try {
		return (
			getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#E23744'
		);
	} catch {
		return '#E23744';
	}
}

type GeocodeFeature = {
	center: LngLat;
	text?: string;
	address?: string;
	context?: { id?: string; text?: string }[];
};

const PLACES = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

/** Geocoding feature → `street`/`zip`/`city` as the existing form fields store them. */
function toPlace(f: GeocodeFeature): Place {
	const pick = (prefix: string) =>
		(f.context ?? []).find((c) => (c.id ?? '').startsWith(prefix))?.text ?? '';
	return {
		center: f.center,
		street: [f.address, f.text].filter(Boolean).join(' '),
		zip: pick('postcode.'),
		city: pick('place.') || pick('locality.') || pick('municipality.')
	};
}

async function firstFeature(path: string, params: Record<string, string>): Promise<Place | null> {
	if (!MAPBOX_TOKEN) return null;
	const url = new URL(`${PLACES}/${path}`);
	url.searchParams.set('country', 'se');
	url.searchParams.set('language', 'sv');
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	url.searchParams.set('access_token', MAPBOX_TOKEN);
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const body = (await res.json()) as { features?: GeocodeFeature[] };
		const f = body.features?.[0];
		return f ? toPlace(f) : null;
	} catch {
		return null;
	}
}

/** Forward geocoding, Sweden only. `near` biases results towards the current view. */
export function geocodeSweden(query: string, near: LngLat = STOCKHOLM): Promise<Place | null> {
	return firstFeature(`${encodeURIComponent(query.trim())}.json`, {
		limit: '1',
		proximity: near.join(',')
	});
}

/** Nearest street address to a point (a dragged pin), Sweden only. */
export function reverseGeocode([lng, lat]: LngLat): Promise<Place | null> {
	return firstFeature(`${lng},${lat}.json`, { limit: '1', types: 'address' });
}

type DirectionsRoute = { duration?: number; geometry?: { coordinates?: LngLat[] } };

/** Road route between two points on the cycling profile (delivery rides a bike). */
export async function cyclingRoute(from: LngLat, to: LngLat): Promise<Route | null> {
	if (!MAPBOX_TOKEN) return null;
	const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/cycling/${from};${to}`);
	url.searchParams.set('geometries', 'geojson');
	url.searchParams.set('overview', 'full');
	url.searchParams.set('access_token', MAPBOX_TOKEN);
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const body = (await res.json()) as { routes?: DirectionsRoute[] };
		const route = body.routes?.[0];
		const coordinates = route?.geometry?.coordinates ?? [];
		if (coordinates.length < 2) return null;
		return { coordinates, seconds: route?.duration ?? 0 };
	} catch {
		return null;
	}
}
