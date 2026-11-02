<script>
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import {
		MAPBOX_TOKEN,
		STOCKHOLM,
		loadMapbox,
		geocodeSweden,
		reverseGeocode
	} from '#lib/mapbox.js';

	/**
	 * Map + pin picker for the address form. Two-way binds the fields the form
	 * validates and submits plus the pin's coordinates, and starts from whatever
	 * they already hold — a saved pin, else the prefilled address geocoded — so
	 * the same picker serves a blank "add" and a prefilled "edit" with no extra
	 * plumbing.
	 * @type {{ street?: string, zip?: string, city?: string, lat?: number|null, lng?: number|null }}
	 */
	let {
		street = $bindable(''),
		zip = $bindable(''),
		city = $bindable(''),
		lat = $bindable(null),
		lng = $bindable(null)
	} = $props();

	/* No token: render nothing, so the form is exactly as it was without a map. */
	const ready = MAPBOX_TOKEN !== '';

	let query = $state('');
	let err = $state('');
	/** @type {HTMLDivElement|null} */
	let canvas = $state(null);
	/** @type {HTMLDivElement|null} */
	let pin = $state(null);
	/** @type {import('#lib/mapbox.js').MapboxMap|null} */
	let map = null;
	/** @type {import('#lib/mapbox.js').MapboxMarker|null} */
	let marker = null;
	/* Only the newest geocode request may write the fields (fast drags race). */
	let seq = 0;

	/** @param {import('#lib/mapbox.js').Place} place @param {boolean} writeFields */
	function apply(place, writeFields) {
		if (writeFields) {
			street = place.street || street;
			zip = place.zip || zip;
			city = place.city || city;
		}
		lat = place.center[1];
		lng = place.center[0];
		marker?.setLngLat(place.center);
		map?.flyTo({ center: place.center, zoom: 16 });
	}

	async function search() {
		const q = query.trim();
		if (!q) return;
		const mine = ++seq;
		const place = await geocodeSweden(q, map?.getCenter().toArray() ?? STOCKHOLM);
		if (mine !== seq) return;
		if (!place) {
			err = t('addr.mapNone');
			return;
		}
		err = '';
		apply(place, true);
	}

	onMount(() => {
		if (!ready || !canvas || !pin) return;
		let alive = true;
		let latest = 0;

		void (async () => {
			const mapboxgl = await loadMapbox();
			if (!alive) return;

			/* Edit mode: a saved pin wins, else the form's address is geocoded. */
			/** @type {import('#lib/mapbox.js').LngLat|null} */
			let start = lat != null && lng != null ? [lng, lat] : null;
			if (!start) {
				const typed = [street, zip, city].filter(Boolean).join(', ');
				start = (typed ? await geocodeSweden(typed) : null)?.center ?? null;
			}
			if (!alive) return;

			map = new mapboxgl.Map({
				container: canvas,
				style: 'mapbox://styles/mapbox/streets-v12',
				center: start ?? STOCKHOLM,
				zoom: start ? 16 : 12,
				// Keeps a 180px map inside a scrollable dialog from hijacking page scroll.
				cooperativeGestures: true
			});
			marker = new mapboxgl.Marker({ draggable: true, element: pin })
				.setLngLat(start ?? STOCKHOLM)
				.addTo(map);
			marker.on('dragend', async () => {
				if (!marker) return;
				const pos = marker.getLngLat();
				const mine = ++latest;
				const place = await reverseGeocode([pos.lng, pos.lat]);
				if (mine !== latest || !place) return;
				err = '';
				apply(place, true);
			});
		})();

		return () => {
			alive = false;
			map?.remove();
			map = null;
			marker = null;
		};
	});
</script>

{#if ready}
	<div class="am-row">
		<div class="search am-search">
			<Icon name="search" size={18} cls="search-ic" />
			<input
				id="na-map-search"
				placeholder={t('addr.mapSearch')}
				aria-label={t('addr.mapSearch')}
				bind:value={query}
				onkeydown={(e) => {
					/* Enter searches here; it must not submit the address form. */
					if (e.key === 'Enter') {
						e.preventDefault();
						void search();
					}
				}}
			/>
		</div>
		<button type="button" class="btn btn-secondary" onclick={search}>{t('nav.search')}</button>
	</div>
	<div class="am-wrap">
		<div class="am-canvas" bind:this={canvas}></div>
		<div class="am-pin" bind:this={pin}><Icon name="pin" size={20} /></div>
	</div>
	<p class="am-hint">{t('addr.mapHint')}</p>
	{#if err}<p class="form-err">{err}</p>{/if}
{/if}

<style>
	.am-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.am-search {
		flex: 1;
		min-width: 0;
	}
	.am-wrap {
		position: relative;
		height: 180px;
		margin-top: 10px;
		border-radius: var(--r-md);
		overflow: hidden;
		background: var(--soft);
	}
	.am-canvas {
		position: absolute;
		inset: 0;
	}
	/* Hidden until Mapbox takes it over and adds .mapboxgl-marker, so it never
	   shows as a stray pin in the corner while the library is still loading. */
	.am-pin {
		position: absolute;
		visibility: hidden;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: #fff;
		border: 2px solid var(--brand);
		color: var(--brand-dark);
		box-shadow: var(--shadow-md);
		cursor: grab;
	}
	.am-pin:active {
		cursor: grabbing;
	}
	.am-pin:global(.mapboxgl-marker) {
		visibility: visible;
	}
	.am-hint {
		margin: 8px 0 0;
		font-size: 12.5px;
		color: var(--muted);
	}
</style>
