<script>
	import { onMount, untrack } from 'svelte';
	import { browser } from '#app/env';
	import Icon from '#lib/components/Icon.svelte';
	import { easeProgress } from '#lib/components/track/ride.js';
	import { t } from '#lib/stores/language.svelte.js';
	import { isDesignCheck } from '#lib/stores/session.svelte.js';
	import {
		MAPBOX_TOKEN,
		STOCKHOLM,
		loadMapbox,
		geocodeSweden,
		cyclingRoute,
		brandColor
	} from '#lib/mapbox.js';

	/**
	 * The rider carrying the order (customer.orderTracking.rider): from the
	 * moment they accept it until it is delivered, else null. `position` is
	 * where their phone last reported, null until its first report.
	 * @typedef {{ stage: 'to_restaurant' | 'at_restaurant' | 'to_customer', stopsBefore: number,
	 *   position: { lat: number, lng: number, heading: number | null, updatedAt: number } | null }} Rider
	 */

	/** @type {{ tr: any, address?: string, destination?: string, rider?: Rider | null }} */
	let { tr, address = '', destination = '', rider = null } = $props();

	const isPickup = $derived(tr.mode === 'pickup');
	const r = $derived(tr.points.restaurant);
	const home = $derived(tr.points.home);
	const c = $derived(tr.courierPos);
	const showCourier = $derived(
		!!tr.courier || (tr.mode === 'delivery' && tr.stepIndex >= 3 && !tr.final)
	);

	const alt = $derived(
		t('track.mapAlt', { status: t('track.step.' + tr.status), km: tr.distanceKm })
	);

	/* Real orders get the Mapbox map; design-check keeps the source's faux map,
	   both for pixel parity and as the no-token fallback. */
	const live = browser && !isDesignCheck() && MAPBOX_TOKEN !== '';

	let canvas = $state(/** @type {HTMLDivElement|null} */ (null));
	let restMk = $state(/** @type {HTMLDivElement|null} */ (null));
	let homeMk = $state(/** @type {HTMLDivElement|null} */ (null));
	let bikeMk = $state(/** @type {HTMLDivElement|null} */ (null));
	/* The rider art. Mapbox rewrites the marker element's own `transform` to
	   place it on the map, so every flip/animation goes on this inner wrapper. */
	let riderEl = $state(/** @type {HTMLElement|null} */ (null));
	/* Set once the map exists; rider positions that arrive earlier wait for it. */
	let ready = $state(false);
	/* Straight-line km from the rider to the door, once they are heading there. */
	let riderKm = $state(/** @type {number|null} */ (null));

	/** @type {any} */
	let turf = null;
	/** @type {import('#lib/mapbox.js').Mapbox|null} */
	let mapboxgl = null;
	/** @type {import('#lib/mapbox.js').MapboxMap|null} */
	let map = null;
	/** @type {import('#lib/mapbox.js').MapboxMarker|null} */
	let bike = null;
	/** Restaurant and home, when geocoded. @type {import('#lib/mapbox.js').LngLat[]} */
	let points = [];
	/** @type {import('#lib/mapbox.js').LngLat|null} */
	let restPoint = null;
	/** @type {import('#lib/mapbox.js').LngLat|null} */
	let homePoint = null;
	/** Where the rider marker is drawn right now; null while there is none. @type {import('#lib/mapbox.js').LngLat|null} */
	let shown = null;
	/* The view frames the rider once, on their first position; after that the
	   customer pans freely and the re-centre button frames them again. */
	let framed = false;
	let raf = 0;

	/** @param {import('#lib/mapbox.js').LngLat[]} list */
	function frame(list) {
		if (!map || !list.length) return;
		if (list.length === 1) {
			map.easeTo({ center: list[0], zoom: 15 });
			return;
		}
		const lngs = list.map((p) => p[0]);
		const lats = list.map((p) => p[1]);
		map.fitBounds(
			[
				[Math.min(...lngs), Math.min(...lats)],
				[Math.max(...lngs), Math.max(...lats)]
			],
			{ padding: 48, maxZoom: 15 }
		);
	}

	/** The rider and where they head next (the restaurant first, then the door). */
	function riderView() {
		if (!shown) return points;
		const ahead = rider?.stage === 'to_customer' ? [homePoint] : [restPoint, homePoint];
		return [shown, ...ahead.filter((p) => p !== null)];
	}

	function recentre() {
		frame(riderView());
	}

	/** @param {import('#lib/mapbox.js').Route} route */
	function drawRoute(route) {
		const add = () => {
			if (!map || map.getSource('route')) return;
			map.addSource('route', {
				type: 'geojson',
				data: {
					type: 'Feature',
					properties: {},
					geometry: { type: 'LineString', coordinates: route.coordinates }
				}
			});
			map.addLayer({
				id: 'route',
				type: 'line',
				source: 'route',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': brandColor(), 'line-width': 4, 'line-opacity': 0.85 }
			});
		};
		/* The style may still be fetching when the directions call comes back. */
		if (map && map.isStyleLoaded()) add();
		else map?.once('load', add);
	}

	/**
	 * Point the side-on rider along the road. The art faces east, so westbound
	 * headings get the extra 180° plus a mirror: the rider stays upright and
	 * the front wheel leads instead of the bike flipping upside down.
	 * @param {number} compass bearing in degrees, clockwise from north
	 */
	function orient(compass) {
		if (!riderEl) return;
		const roadAngle = compass - 90;
		const west = Math.cos((roadAngle * Math.PI) / 180) < 0;
		const next = west
			? `rotate(${roadAngle + 180}deg) scaleX(-1)`
			: `rotate(${roadAngle}deg) scaleX(1)`;
		if (riderEl.style.transform !== next) riderEl.style.transform = next;
	}

	/**
	 * Put the rider where their phone last reported, gliding over from the
	 * previous position (the phone reports about every 30 s). No position
	 * removes the marker: no rider yet, no report yet, or the order is delivered.
	 * @param {Rider | null} next
	 */
	function showRider(next) {
		if (!map || !mapboxgl || !bikeMk) return;
		cancelAnimationFrame(raf);
		raf = 0;
		const position = next?.position;
		if (!next || !position) {
			bike?.remove();
			bike = null;
			shown = null;
			riderKm = null;
			return;
		}
		/** @type {import('#lib/mapbox.js').LngLat} */
		const to = [position.lng, position.lat];
		riderKm =
			next.stage === 'to_customer' && next.stopsBefore === 0 && homePoint
				? Math.max(0.1, +turf.distance(to, homePoint, { units: 'kilometers' }).toFixed(1))
				: null;
		const from = shown;
		if (!bike || !from) {
			bike = new mapboxgl.Marker({ element: bikeMk, anchor: 'center' }).setLngLat(to).addTo(map);
			shown = to;
			if (position.heading !== null) orient(position.heading);
			if (!framed) {
				framed = true;
				recentre();
			}
			return;
		}
		/* The phone's own heading when it has one (it is moving), else the way it went. */
		const moved = turf.distance(from, to, { units: 'kilometers' }) > 0.005;
		if (position.heading !== null) orient(position.heading);
		else if (moved) orient(turf.bearing(from, to));
		if (!moved || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			bike.setLngLat(to);
			shown = to;
			return;
		}
		let progress = 0;
		let prev = performance.now();
		/** @param {number} now */
		const step = (now) => {
			/* A hidden tab returns one huge frame gap; cap it so the glide resumes. */
			const dt = Math.max(0, Math.min(now - prev, 100));
			prev = now;
			progress = easeProgress(progress, 1, dt);
			if (progress > 1 - 1e-3) progress = 1;
			shown = [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
			bike?.setLngLat(shown);
			raf = progress < 1 ? requestAnimationFrame(step) : 0;
		};
		raf = requestAnimationFrame(step);
	}

	$effect(() => {
		const next = rider;
		if (ready) untrack(() => showRider(next));
	});

	onMount(() => {
		if (!live || !canvas) return;
		let alive = true;

		const boot = async () => {
			const [mapbox, turfModule] = await Promise.all([loadMapbox(), import('@turf/turf')]);
			if (!alive) return;
			turf = turfModule;
			mapboxgl = mapbox;
			/* Restaurant coordinates come from its stored address; the customer's
			   from the order's delivery address (both Swedish, both geocoded).
			   A street alone is ambiguous — Stockholm has a Linnégatan too — so
			   the postal code and city ride along when the row has them. */
			const fromQuery = [tr.restaurant?.address, tr.restaurant?.postalCode, tr.restaurant?.city]
				.filter(Boolean)
				.join(', ');
			const [from, to] = await Promise.all([
				fromQuery ? geocodeSweden(fromQuery) : null,
				!isPickup && destination ? geocodeSweden(destination) : null
			]);
			if (!alive) return;

			restPoint = from?.center ?? null;
			homePoint = to?.center ?? null;
			points = [from?.center, to?.center].filter(Boolean);
			map = new mapbox.Map({
				container: canvas,
				style: 'mapbox://styles/mapbox/streets-v12',
				center: points[0] ?? STOCKHOLM,
				zoom: 14,
				// Keeps the map from hijacking page scroll (the phone layout
				// scrolls a sheet underneath it).
				cooperativeGestures: true
			});
			/* Fit both ends of the ride with room for the chips and the button. */
			if (points.length > 1) frame(points);
			if (from && restMk) new mapbox.Marker({ element: restMk }).setLngLat(from.center).addTo(map);
			if (to && homeMk) new mapbox.Marker({ element: homeMk }).setLngLat(to.center).addTo(map);
			/* From here the rider marker follows the real positions ($effect above). */
			ready = true;

			if (!from || !to) return;
			const route = await cyclingRoute(from.center, to.center);
			if (!alive || !route) return;
			drawRoute(route);
		};

		/* The page renders two TrackMaps (phone + desktop) and hides one per
		   width: only the visible one builds a map, the hidden one catches up
		   when a resize/rotation shows it. */
		const ro = new ResizeObserver(() => {
			if (canvas && canvas.clientWidth > 0) {
				ro.disconnect();
				void boot();
			}
		});
		ro.observe(canvas);

		return () => {
			alive = false;
			ro.disconnect();
			cancelAnimationFrame(raf);
			raf = 0;
			map?.remove();
			map = null;
			bike = null;
			shown = null;
		};
	});
</script>

<!-- A group, never role=img: the recentre button / Mapbox controls are focusable. The fallback drawing is the img. -->
<div class="map" class:is-live={live} role="group" aria-label={live ? alt : undefined}>
	{#if live}
		<div class="map-canvas" bind:this={canvas}></div>
		<div class="mk mk-rest" bind:this={restMk}><Icon name="pin" size={26} /></div>
		{#if !isPickup}<div class="mk mk-home" bind:this={homeMk}>
				<Icon name="pin" size={16} />
			</div>{/if}
		<div class="mk mk-bike" bind:this={bikeMk}>
			<span class="rider-halo" aria-hidden="true"></span>
			<div class="bike-inner" bind:this={riderEl} aria-hidden="true">
				<svg class="rider" viewBox="0 0 52 42">
					<ellipse cx="26" cy="38.8" rx="15" ry="1.8" fill="rgba(35,28,28,.14)" />
					<!-- delivery box -->
					<path
						d="M14.3 14 20 15.2"
						stroke="var(--brand-dark)"
						stroke-width="1.6"
						stroke-linecap="round"
					/>
					<rect x="4" y="11" width="10.5" height="10" rx="2.2" fill="var(--brand)" />
					<rect x="5.4" y="14.2" width="7.6" height="2.3" rx="1.15" fill="#fff" opacity=".92" />
					<!-- wheels -->
					<g class="wheel">
						<circle cx="12" cy="30.5" r="7.3" fill="#fff" stroke="var(--dark)" stroke-width="2" />
						<path
							d="M12 24.6v11.8M6.1 30.5h11.8"
							stroke="var(--dark)"
							stroke-width="1"
							opacity=".45"
						/>
					</g>
					<g class="wheel">
						<circle cx="40.5" cy="30.5" r="7.3" fill="#fff" stroke="var(--dark)" stroke-width="2" />
						<path
							d="M40.5 24.6v11.8M34.6 30.5h11.8"
							stroke="var(--dark)"
							stroke-width="1"
							opacity=".45"
						/>
					</g>
					<!-- frame -->
					<g
						fill="none"
						stroke="var(--dark)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M12 30.5h13.5" />
						<path d="M25.5 30.5 20.5 19h12.5" />
						<path d="M33 19l7.5 11.5" />
						<path d="M20.5 19l-2.3-2.4h6" />
						<path d="M33 19l3.4-3" />
						<path d="M35.6 15.2l3.4 1.6" />
					</g>
					<!-- rider: leg, torso, arm, head, helmet -->
					<path
						d="M21.5 17.5l5 5.5-1.5 6.4"
						fill="none"
						stroke="var(--dark)"
						stroke-width="3.4"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M21.5 17.5l8-5"
						stroke="var(--brand)"
						stroke-width="6.2"
						stroke-linecap="round"
					/>
					<path
						d="M29 12.8l7.4 3.5"
						stroke="var(--brand-dark)"
						stroke-width="2.8"
						stroke-linecap="round"
					/>
					<circle cx="33.2" cy="8.6" r="3.3" fill="#fff" stroke="var(--dark)" stroke-width="1.2" />
					<path d="M29.8 8.7a3.5 3.5 0 0 1 6.8-.4l1.5.7" fill="var(--brand)" />
					<circle cx="25.6" cy="29.4" r="1.7" fill="var(--brand-dark)" />
				</svg>
			</div>
		</div>
	{:else}
		<svg
			class="map-svg"
			viewBox="0 0 100 100"
			preserveAspectRatio="xMidYMid slice"
			role="img"
			aria-label={alt}
		>
			<rect x="0" y="0" width="100" height="100" fill="var(--soft)" />
			<!-- faux streets -->
			<g stroke="#fff" stroke-width="3" opacity="0.9" stroke-linecap="round">
				<path d="M-5 30 H105" /><path d="M-5 62 H105" />
				<path d="M28 -5 V105" /><path d="M70 -5 V105" />
			</g>
			<g stroke="#fff" stroke-width="1.4" opacity="0.7">
				<path d="M-5 46 H105" /><path d="M48 -5 V105" />
			</g>

			{#if !isPickup}
				<!-- dotted courier → home -->
				<path
					d="M{showCourier ? c.x : r.x} {showCourier ? c.y : r.y} L{home.x} {home.y}"
					stroke="var(--brand)"
					stroke-width="1.6"
					stroke-dasharray="2 3"
					fill="none"
					opacity="0.75"
				/>
				<!-- solid restaurant → courier -->
				{#if showCourier}
					<path
						d="M{r.x} {r.y} L{c.x} {c.y}"
						stroke="var(--brand)"
						stroke-width="2.2"
						fill="none"
					/>
				{/if}
				<!-- home marker -->
				<g transform="translate({home.x} {home.y})">
					<path
						d="M0 -6 C3.3 -6 5 -3.6 5 -1.2 C5 2.4 0 7 0 7 C0 7 -5 2.4 -5 -1.2 C-5 -3.6 -3.3 -6 0 -6 Z"
						fill="var(--dark)"
					/>
					<circle cx="0" cy="-1" r="1.8" fill="#fff" />
				</g>
			{/if}

			<!-- restaurant marker -->
			<g class="rest-pin" transform="translate({r.x} {r.y})">
				<path
					d="M0 -6 C3.3 -6 5 -3.6 5 -1.2 C5 2.4 0 7 0 7 C0 7 -5 2.4 -5 -1.2 C-5 -3.6 -3.3 -6 0 -6 Z"
					fill="var(--brand)"
				/>
				<circle cx="0" cy="-1" r="1.8" fill="#fff" />
			</g>

			<!-- courier marker -->
			{#if showCourier}
				<g class="courier" style="transform: translate({c.x}px, {c.y}px)">
					<circle class="pulse" r="5" fill="var(--brand)" opacity="0.25" />
					<circle r="4.6" fill="var(--brand)" />
				</g>
			{/if}
		</svg>

		<!-- bike glyph overlaid on courier (HTML, crisp) -->
		{#if showCourier}
			<span class="courier-ic" style="left: {c.x}%; top: {c.y}%"
				><Icon name="bike" size={13} /></span
			>
		{/if}
	{/if}

	<span class="chip chip-tl"
		>{riderKm !== null
			? t('track.distanceOnly', { km: riderKm })
			: tr.showEta || tr.final || tr.cancelled
				? t('track.distanceEta', { km: tr.distanceKm, n: tr.minutesLeft })
				: t('track.distanceOnly', { km: tr.distanceKm })}</span
	>
	{#if address}<span class="chip chip-tr">{address}</span>{/if}

	{#if isPickup && tr.restaurant}
		<a
			class="chip chip-dir"
			href="https://www.openstreetmap.org/search?query={encodeURIComponent(
				tr.restaurant.address || tr.restaurant.name
			)}"
			target="_blank"
			rel="noopener">{t('track.getDirections')} <Icon name="arrow" size={14} /></a
		>
	{/if}

	<button class="recentre" aria-label={t('track.recentre')} onclick={recentre}
		><Icon name="pin" size={18} /></button
	>
</div>

<style>
	.map {
		position: relative;
		height: 330px;
		border-radius: var(--r-lg);
		overflow: hidden;
		background: var(--soft);
	}
	.map-canvas {
		position: absolute;
		inset: 0;
	}
	/* Marker shells live in the markup (so they can use Icon); Mapbox adds
	   .mapboxgl-marker to them, and only then are they shown. */
	.mk {
		position: absolute;
		visibility: hidden;
		display: grid;
		place-items: center;
	}
	.mk:global(.mapboxgl-marker) {
		visibility: visible;
	}
	/* Restaurant origin: a plain pin, not the old letter badge. The white
	   halo keeps the thin outline readable over the route line. */
	.mk-rest {
		width: 30px;
		height: 30px;
		color: var(--brand);
		filter: drop-shadow(0 1px 1px #fff) drop-shadow(0 2px 3px rgba(35, 28, 28, 0.35));
	}
	.mk-home {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--dark);
		color: #fff;
		box-shadow: var(--shadow-sm);
	}
	/* The badge is a circle so it pivots cleanly on the route line. */
	.mk-bike {
		width: 44px;
		height: 44px;
		border-radius: 9999px;
	}
	/* Soft red glow pulsing out from behind the badge. */
	.rider-halo {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		background: var(--brand);
		opacity: 0;
		animation: rider-pulse 2.4s ease-out infinite;
	}
	/* Every rotation/animation lives here: Mapbox rewrites the marker element's
	   own transform to place it on the map, so animating the root would fight
	   it and make the bike jump. orient() writes the road-facing transform and
	   the bob animates `translate`, which composes with it. */
	.bike-inner {
		position: relative;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 9999px;
		background: #fff;
		border: 1px solid var(--border);
		box-shadow: var(--shadow-md);
		animation: rider-bob 1.6s ease-in-out infinite;
	}
	.rider {
		display: block;
		width: 30px;
		height: 24px;
	}
	.wheel {
		transform-box: fill-box;
		transform-origin: center;
		animation: wheel-spin 1.15s linear infinite;
	}
	@keyframes wheel-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes rider-bob {
		0%,
		100% {
			translate: 0 0;
		}
		50% {
			translate: 0 -1.5px;
		}
	}
	@keyframes rider-pulse {
		0% {
			transform: scale(0.82);
			opacity: 0.3;
		}
		70%,
		100% {
			transform: scale(1.45);
			opacity: 0;
		}
	}
	.map-svg {
		width: 100%;
		height: 100%;
		display: block;
	}
	.courier {
		transition: transform 0.6s ease;
	}
	.pulse {
		transform-box: fill-box;
		transform-origin: center;
		animation: map-pulse 1.8s ease-out infinite;
	}
	.courier-ic {
		position: absolute;
		transform: translate(-50%, -50%);
		color: #fff;
		pointer-events: none;
		transition:
			left 0.6s ease,
			top 0.6s ease;
		display: grid;
		place-items: center;
	}
	.chip {
		position: absolute;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		max-width: 60%;
		padding: 7px 11px;
		background: #fff;
		border-radius: 999px;
		box-shadow: var(--shadow-sm);
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chip-tl {
		top: 12px;
		left: 12px;
	}
	.chip-tr {
		top: 12px;
		right: 12px;
		color: var(--text-2);
		font-weight: 500;
	}
	.chip-dir {
		bottom: 12px;
		left: 12px;
		color: var(--brand-dark);
	}
	.recentre {
		position: absolute;
		bottom: 12px;
		right: 12px;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		background: #fff;
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
	.recentre:hover {
		background: var(--soft);
	}
	/* Mapbox draws its logo and attribution into the two bottom corners, so the
	   controls sitting there move up out of their way (SVG map: unchanged). */
	.is-live .recentre {
		bottom: 44px;
	}
	.is-live .chip-dir {
		bottom: 44px;
	}
	@keyframes map-pulse {
		0% {
			transform: scale(1);
			opacity: 0.35;
		}
		100% {
			transform: scale(2.6);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bike-inner,
		.rider-halo,
		.wheel,
		.pulse {
			animation: none;
		}
		.courier,
		.courier-ic {
			transition: none;
		}
	}
</style>
