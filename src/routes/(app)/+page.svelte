<script>
	import { browser } from '#app/env';
	import { goto } from '#app/navigation';
	import { onMount } from 'svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '@blinca/backend/convex/_generated/api';
	import { isDesignCheck } from '#lib/stores/session.svelte.js';
	import Icon from '#lib/components/Icon.svelte';
	import Glyph from '#lib/components/Glyph.svelte';
	import Img from '#lib/components/Img.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { organization, website, webPage } from '#lib/seo/jsonld.js';
	import { m } from '#lib/paraglide/messages.js';
	import SearchBox from '#lib/components/SearchBox.svelte';
	import AddControl from '#lib/components/AddControl.svelte';
	import DealTicket from '#lib/components/DealTicket.svelte';
	import TrendingList from '#lib/components/TrendingList.svelte';
	import RestaurantCard from '#lib/components/RestaurantCard.svelte';
	import RestaurantRow from '#lib/components/RestaurantRow.svelte';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import FiltersDrawer from '#lib/components/FiltersDrawer.svelte';
	import IntentDrawer from '#lib/components/IntentDrawer.svelte';
	import ScheduleDialog from '#lib/components/ScheduleDialog.svelte';
	import OfferCard from '#lib/components/OfferCard.svelte';
	import CuisineRail from '#lib/components/home/CuisineRail.svelte';
	import PromoBanners from '#lib/components/home/PromoBanners.svelte';
	import RestaurantRail from '#lib/components/home/RestaurantRail.svelte';
	import WhyBlinca from '#lib/components/home/WhyBlinca.svelte';
	import JoinBand from '#lib/components/home/JoinBand.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { getSiteData } from '#lib/stores/catalog.svelte.js';
	import { restaurant, item } from '#lib/stores/catalog.svelte.js';
	import { cart, cartRestaurant, count, subtotal, pricing } from '#lib/stores/cart.svelte.js';
	import { user } from '#lib/stores/user.svelte.js';
	import { address } from '#lib/stores/address.svelte.js';
	import { postcodeDigits } from '#lib/postcode.js';
	import { orders, reorderOrder, lineLabel } from '#lib/stores/orders.svelte.js';
	import { openDrawer, openModal } from '#lib/layers.svelte.js';
	import {
		norm,
		cuisine,
		cuisineNames,
		priceLevel,
		L,
		kr,
		prKr,
		restaurantUrl,
		fmtDate,
		fmtTime
	} from '#lib/format.js';
	import { requestAdd, toggleFav, openOffers, openCart } from '#lib/ui.js';
	import {
		isNew as offerIsNew,
		hasNew,
		activeOffers,
		offerKey
	} from '#lib/stores/offers.svelte.js';

	const D = getSiteData();

	/* ---------- filter state (mirrors legacy st, synced to the URL) ---------- */
	const EMPTY = { sort: 'recommended', open: false, free: false, veg: false, time: 0, rating: 0 };
	/** @type {Record<string, any>} */
	let f = $state({ ...EMPTY, price: [], cuisines: [] });
	/** @type {string|null} */
	let mood = $state(null);
	let q = $state('');
	let view = $state('grid');
	let laterExpanded = $state(false);
	let openPages = $state(1);
	/** @type {string|null} */
	let openPop = $state(null);
	let nowTick = $state(0);
	let showTop = $state(false);

	function loadView() {
		try {
			return window.localStorage.getItem('blinca.v1.homeView') === 'list' ? 'list' : 'grid';
		} catch {
			return 'grid';
		}
	}
	/** @param {string} v */
	function saveView(v) {
		try {
			window.localStorage.setItem('blinca.v1.homeView', v);
		} catch {
			/* private mode */
		}
	}
	const isPhone = () => browser && window.matchMedia('(max-width: 760px)').matches;
	const isNarrowPop = () => browser && window.matchMedia('(max-width: 1080px)').matches;

	function readURL() {
		try {
			const p = new URLSearchParams(window.location.search);
			const qq = p.get('q');
			if (qq) q = qq;
			const s = p.get('sort');
			if (s === 'recommended' || s === 'fastest' || s === 'top') f.sort = s;
			if (p.get('open') === '1') f.open = true;
			if (p.get('free') === '1') f.free = true;
			if (p.get('veg') === '1') f.veg = true;
			const tm = parseInt(p.get('time') || '', 10);
			if (tm === 20 || tm === 30 || tm === 45) f.time = tm;
			const ra = parseFloat(p.get('rating') || '');
			if (ra === 4 || ra === 4.5) f.rating = ra;
			const pr = p.get('price');
			if (pr)
				f.price = pr
					.split(',')
					.map((x) => +x)
					.filter((x) => x === 1 || x === 2 || x === 3);
			const cu = p.get('cuisines');
			if (cu) f.cuisines = cu.split(',').filter((id) => !!cuisine(id));
			const mo = p.get('mood');
			if (mo && D.moods.some((m) => m.id === mo)) mood = mo;
			const vw = p.get('view');
			if (vw === 'list' || vw === 'grid') {
				view = vw;
				saveView(vw);
			}
			if (p.get('expanded') === '1') laterExpanded = true;
			const pg = parseInt(p.get('pages') || '', 10);
			if (pg > 1 && pg < 50) openPages = pg;
			// /cart and the pay pages link to /?cart=open (they cannot open the
			// drawer themselves). Open it, then drop the flag so a reload or a
			// back-navigation does not reopen it.
			if (p.get('cart') === 'open') {
				openCart();
				p.delete('cart');
				const qs = p.toString();
				// Shallow: update the URL without navigating or adding a history
				// entry, so a reload or back-navigation does not reopen it.
				goto(window.location.pathname + (qs ? '?' + qs : '') + window.location.hash, {
					shallow: true,
					replace: true
				});
			}
		} catch {
			/* keep defaults */
		}
	}

	function writeURL() {
		if (!browser || !history.replaceState) return;
		const p = new URLSearchParams();
		if (q) p.set('q', q);
		if (mood) p.set('mood', mood);
		if (f.sort !== 'recommended') p.set('sort', f.sort);
		if (f.open) p.set('open', '1');
		if (f.free) p.set('free', '1');
		if (f.veg) p.set('veg', '1');
		if (f.time) p.set('time', String(f.time));
		if (f.rating) p.set('rating', String(f.rating));
		if (f.price.length) p.set('price', [...f.price].sort().join(','));
		if (f.cuisines.length) p.set('cuisines', f.cuisines.join(','));
		if (view === 'list') p.set('view', 'list');
		if (laterExpanded) p.set('expanded', '1');
		if (openPages > 1) p.set('pages', String(openPages));
		const qs = p.toString();
		history.replaceState(
			null,
			'',
			window.location.pathname + (qs ? '?' + qs : '') + window.location.hash
		);
	}

	function resetPaging() {
		openPages = 1;
		laterExpanded = false;
	}

	/* ---------- catalog helpers ---------- */
	const listed = $derived(D.restaurants.filter((r) => r.listed || r.status === 'open'));
	// Search, open-now and the visitor's postal code are resolved by the backend;
	// design-check (no backend) and the first paint fall back to the client filters.
	const live =
		browser && !isDesignCheck()
			? useQuery(api.customer.restaurants.list, () => ({
					postalCode: postcodeDigits(address().zip) ?? undefined,
					search: q.trim() || undefined,
					// Cuisine labels are localized here, so resolve a typed label to ids.
					searchCuisineIds: q.trim()
						? D.cuisines
								.filter(
									(c) => norm(c.name.en).includes(norm(q)) || norm(c.name.sv).includes(norm(q))
								)
								.map((c) => c.id)
						: undefined,
					openNowOnly: f.open || undefined
				}))
			: null;
	const served = $derived(!!live?.data);
	const allListed = $derived.by(() => {
		const rows = D.restaurants.filter((r) => r.listed);
		if (!live?.data) return rows;
		const cards = new Map(live.data.restaurants.map((c) => [c.slug, c]));
		return rows
			.filter((r) => cards.has(r.slug))
			.map((r) => {
				const c = cards.get(r.slug);
				const z = c?.zoneDelivery;
				return z ? { ...r, fee: z.feeCents / 100, eta: c.deliveryMinutes } : r;
			});
	});
	const dishes = $derived.by(() => {
		/** @type {Array<{ r: any, i: any }>} */
		const out = [];
		listed.forEach((r) => r.menu.forEach((c) => c.items.forEach((i) => out.push({ r, i }))));
		return out;
	});
	const minutes = (/** @type {string} */ hhmm) => {
		const p = hhmm.split(':');
		return +p[0] * 60 + +p[1];
	};
	const nowMin = $derived.by(() => {
		void nowTick;
		const d = new Date();
		return d.getHours() * 60 + d.getMinutes();
	});

	const INTENTS = [
		{ id: 'fast', icon: 'bike', kind: 'dish' },
		{ id: 'cheap', icon: 'tag', kind: 'dish' },
		{ id: 'light', icon: 'leaf', kind: 'dish' },
		{ id: 'family', icon: 'user', kind: 'rest' },
		{ id: 'spicy', icon: 'flame', kind: 'dish' },
		{ id: 'top', icon: 'star', kind: 'rest' }
	];

	/** @param {{ id: string, kind: string }} it @returns {any[]} */
	function intentItems(it) {
		if (it.kind === 'dish') {
			return dishes.filter((x) => {
				if (it.id === 'fast') return x.r.eta <= 25;
				if (it.id === 'cheap') return x.i.price < 100;
				if (it.id === 'light')
					return (
						(x.i.tags || []).includes('vegetarian') ||
						x.r.cuisines.some((/** @type {string} */ c) => c === 'vegan' || c === 'healthy')
					);
				if (it.id === 'spicy') return (x.i.tags || []).includes('spicy');
				return true;
			});
		}
		return listed.filter((r) => {
			if (it.id === 'family')
				return (
					r.priceLevel <= 2 && r.cuisines.some((c) => ['pizza', 'burgers', 'kebab'].includes(c))
				);
			if (it.id === 'top') return r.rating >= 4.5;
			return true;
		});
	}

	/* ---------- greeting ---------- */
	function greetingKey() {
		const h = Number(fmtTime(new Date(), 'sv').slice(0, 2));
		return h < 5 ? 'h2.evening' : h < 11 ? 'h2.morning' : h < 17 ? 'h2.afternoon' : 'h2.evening';
	}
	function mealKey() {
		const h = new Date().getHours();
		return h < 10 ? 'h2.breakfast' : h < 15 ? 'h2.lunch' : h < 17 ? 'h2.fika' : 'h2.dinner';
	}
	const clockLine = $derived.by(() => {
		void nowTick;
		const d = new Date();
		const day = fmtDate(d, lang(), { weekday: 'long' });
		return (
			day.charAt(0).toUpperCase() + day.slice(1) + ' · ' + fmtTime(d, lang()) + ' · ' + t(mealKey())
		);
	});
	const helloEta = $derived.by(() => {
		const etas = listed.filter((r) => r.status === 'open').map((r) => r.eta);
		return etas.length ? Math.min(...etas) + 5 : 0;
	});
	/** @param {{ cuisines: string[] }} m */
	function moodRests(m) {
		return listed.filter((r) => r.cuisines.some((c) => m.cuisines.includes(c)));
	}
	const firstName = $derived.by(() => {
		const u = user();
		return u ? u.name.split(' ')[0] : '';
	});

	/* ---------- filtering ---------- */
	const filtered = $derived.by(() => {
		let list = [...allListed];
		if (q && !served) {
			const qq = norm(q);
			list = list.filter(
				(r) =>
					norm(r.name).includes(qq) ||
					r.cuisines.some((c) => {
						const cu = cuisine(c);
						return cu && (norm(cu.name.en).includes(qq) || norm(cu.name.sv).includes(qq));
					}) ||
					r.menu.some((cat) =>
						cat.items.some((i) => norm(i.name.en).includes(qq) || norm(i.name.sv).includes(qq))
					)
			);
		}
		if (mood) {
			const m = D.moods.find((x) => x.id === mood);
			if (m) list = list.filter((r) => r.cuisines.some((c) => m.cuisines.includes(c)));
		}
		if (f.open && !served) list = list.filter((r) => r.status === 'open');
		if (f.free) list = list.filter((r) => r.fee === 0);
		if (f.veg) list = list.filter((r) => r.veg);
		if (f.time) list = list.filter((r) => r.eta <= f.time);
		if (f.rating) list = list.filter((r) => r.rating >= f.rating);
		if (f.price.length) list = list.filter((r) => f.price.includes(r.priceLevel));
		if (f.cuisines.length)
			list = list.filter((r) => r.cuisines.some((c) => f.cuisines.includes(c)));
		if (f.sort === 'fastest') list.sort((a, b) => a.eta - b.eta);
		if (f.sort === 'top') list.sort((a, b) => b.rating - a.rating);
		return list;
	});
	const activeCount = $derived(
		(f.open ? 1 : 0) +
			(f.free ? 1 : 0) +
			(f.veg ? 1 : 0) +
			(f.time ? 1 : 0) +
			(f.rating ? 1 : 0) +
			f.price.length +
			f.cuisines.length
	);
	const totalLabel = $derived(
		filtered.length === 1 ? t('home.count1') : t('home.count', { n: filtered.length })
	);
	const cuisineCounts = $derived.by(() => {
		/** @type {Record<string, number>} */
		const c = {};
		allListed.forEach((r) => r.cuisines.forEach((x) => (c[x] = (c[x] || 0) + 1)));
		return c;
	});
	const openList = $derived(filtered.filter((r) => r.status === 'open'));
	const laterList = $derived.by(() => {
		const later = filtered.filter((r) => r.status !== 'open');
		later.sort((a, b) => {
			const ap = a.status === 'paused' ? 1 : 0,
				bp = b.status === 'paused' ? 1 : 0;
			if (ap !== bp) return ap - bp;
			return minutes(a.opensAt) - minutes(b.opensAt);
		});
		return later;
	});
	const openLimit = $derived((isPhone() ? 8 : 12) + Math.max(0, openPages - 1) * 12);
	const showingLabel = $derived(t('home.showing', { x: filtered.length, y: allListed.length }));

	const appliedItems = $derived.by(() => {
		/** @type {Array<[string, string]>} */
		const items = [];
		if (q) items.push(['q', '“' + q + '”']);
		if (mood) {
			const m = D.moods.find((x) => x.id === mood);
			if (m) items.push(['mood', L(m.name, lang())]);
		}
		if (f.open) items.push(['open', t('qf.open')]);
		if (f.time) items.push(['time', t('home.underMin', { n: f.time })]);
		if (f.free) items.push(['free', t('qf.free')]);
		if (f.rating) items.push(['rating', t('home.ratingPlus', { n: f.rating.toFixed(1) })]);
		if (f.veg) items.push(['veg', t('qf.veg')]);
		[...f.price].sort().forEach((p) => items.push(['price:' + p, priceLevel(p)]));
		f.cuisines.forEach((/** @type {string} */ c) => {
			const cu = cuisine(c);
			if (cu) items.push(['cuisine:' + c, L(cu.name, lang())]);
		});
		return items;
	});

	/* ---------- deals + trending ---------- */
	/** @param {any} o */
	function dealStatus(o) {
		const d = new Date();
		if (o.rule.untilHour != null) {
			const left = o.rule.untilHour * 60 - nowMin;
			return left > 0
				? {
						txt: t('h2.endsIn', {
							t: left >= 60 ? Math.floor(left / 60) + ' h ' + (left % 60) + ' min' : left + ' min'
						}),
						live: true
					}
				: { txt: t('h2.endedToday'), off: true };
		}
		if (o.rule.weekday != null)
			return d.getDay() === o.rule.weekday
				? { txt: t('h2.todayOnly'), live: true }
				: { txt: t('h2.everyTuesday') };
		if (o.code === 'HELG')
			return { txt: d.getDay() === 0 ? t('h2.endsTonight') : t('h2.endsSunday') };
		return { txt: t('h2.noEnd') };
	}
	const sortedOffers = $derived(
		[...activeOffers()].sort((a, b) => {
			const n = (offerIsNew(b) ? 1 : 0) - (offerIsNew(a) ? 1 : 0);
			if (n) return n;
			return (dealStatus(b).live ? 1 : 0) - (dealStatus(a).live ? 1 : 0);
		})
	);
	const trendRows = $derived.by(() => {
		/** @type {Array<{ x: any, i: number }>} */
		const rows = [];
		D.trending.forEach((/** @type {any[]} */ x, /** @type {number} */ i) => {
			const r = restaurant(x[0]);
			if (r && item(x[0], x[1])) rows.push({ x, i });
		});
		return rows;
	});
	const duoRows = $derived.by(() => {
		const w = browser ? window.innerWidth || 1440 : 1440;
		if (w > 760 && w <= 1080) return 5;
		return Math.max(3, Math.min(trendRows.length, 5));
	});
	let trendOpen = $state(false);

	/* ---------- actions ---------- */
	function goAll() {
		document
			.getElementById('all-restaurants')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	/** @param {string} v */
	function onSearch(v) {
		q = v;
		resetPaging();
		writeURL();
		goAll();
	}
	/** @param {string} id */
	function pickMood(id) {
		mood = mood === id ? null : id;
		resetPaging();
		writeURL();
		if (mood) goAll();
	}
	/** @param {string} rk */
	function removeFilter(rk) {
		if (rk === 'q') {
			q = '';
			document.querySelectorAll('.search-input').forEach((/** @type {any} */ i) => (i.value = ''));
		} else if (rk === 'mood') mood = null;
		else if (rk === 'time' || rk === 'rating') f[rk] = 0;
		else if (rk.startsWith('price:'))
			f.price = f.price.filter((/** @type {number} */ p) => p !== +rk.slice(6));
		else if (rk.startsWith('cuisine:'))
			f.cuisines = f.cuisines.filter((/** @type {string} */ c) => c !== rk.slice(8));
		else f[rk] = false;
		resetPaging();
		writeURL();
	}
	function clearAll() {
		const s = f.sort,
			v = view;
		f = { ...EMPTY, price: [], cuisines: [] };
		f.sort = s;
		mood = null;
		q = '';
		view = v;
		laterExpanded = false;
		openPages = 1;
		document.querySelectorAll('.search-input').forEach((/** @type {any} */ i) => (i.value = ''));
		writeURL();
	}
	/** @param {string} k */
	function toggleQuick(k) {
		if (k === 'fast') f.time = f.time === 30 ? 0 : 30;
		else if (k === 'top') f.rating = f.rating === 4.5 ? 0 : 4.5;
		else f[k] = !f[k];
		resetPaging();
		writeURL();
	}
	/** @param {string} id */
	function onPop(id) {
		if (isNarrowPop()) {
			openFilters();
			return;
		}
		openPop = openPop === id ? null : id;
	}
	function openFilters() {
		openDrawer(
			FiltersDrawer,
			{
				initial: JSON.parse(JSON.stringify({ ...f })),
				countFor: (/** @type {any} */ d) =>
					(d.open ? 1 : 0) +
					(d.free ? 1 : 0) +
					(d.veg ? 1 : 0) +
					(d.time ? 1 : 0) +
					(d.rating ? 1 : 0) +
					d.price.length +
					d.cuisines.length,
				onApply: (/** @type {any} */ d) => {
					f.sort = d.sort;
					f.open = d.open;
					f.free = d.free;
					f.veg = d.veg;
					f.time = d.time;
					f.rating = d.rating;
					f.price = d.price;
					f.cuisines = d.cuisines;
					resetPaging();
					writeURL();
					goAll();
				}
			},
			{ side: 'left', label: t('home.filters'), className: 'drawer-filters' }
		);
	}
	/** @param {string} id */
	function openIntent(id) {
		openDrawer(IntentDrawer, { intentId: id }, { side: 'right', label: t('h2.int.' + id) });
	}
	/** @param {string} slug */
	/** @param {string} slug */
	function openSchedule(slug) {
		const r = restaurant(slug);
		if (!r) return;
		openModal(ScheduleDialog, { slug }, { label: t('h2.schedTitle', { name: r.name }) });
	}

	/* ---------- scroll wiring (fades, back-to-top, pop close) ---------- */
	function updateDuoFades() {
		document.querySelectorAll('.duo-scroll').forEach((el) => {
			const box = /** @type {HTMLElement} */ (el);
			box.classList.toggle('can-up', box.scrollTop > 4);
			box.classList.toggle('can-down', box.scrollTop + box.clientHeight < box.scrollHeight - 4);
		});
	}
	function updateTop() {
		const sec = document.getElementById('all-restaurants');
		if (!sec) return;
		const top = sec.getBoundingClientRect().top + window.scrollY;
		showTop = window.scrollY > top + 2 * window.innerHeight;
	}

	onMount(() => {
		view = loadView();
		readURL();
		const foot = document.getElementById('site-footer');
		if (foot) foot.style.marginTop = '0';
		const fb = document.querySelector('.ftr-logo img');
		if (fb && !fb.getAttribute('data-fb')) {
			fb.setAttribute('data-fb', '1');
			fb.setAttribute('onerror', "this.onerror=null;this.src='/img/logo-white.png'");
		}
		const onScroll = () => {
			updateDuoFades();
			updateTop();
		};
		/** @param {MouseEvent} e */
		const onDocClick = (e) => {
			if (openPop && !(e.target instanceof Element && e.target.closest('.bar-pop'))) openPop = null;
			const a = e.target instanceof Element && e.target.closest('a[href*="/restaurants/"]');
			if (a) {
				try {
					window.sessionStorage.setItem('blinca.v1.homeScroll', String(window.scrollY));
				} catch {
					/* noop */
				}
			}
		};
		/** @param {KeyboardEvent} e */
		const onKey = (e) => {
			if (e.key === 'Escape' && openPop) openPop = null;
		};
		const onResize = () => {
			updateDuoFades();
			updateTop();
		};
		document.querySelectorAll('.duo-scroll').forEach((el) => {
			/** @type {HTMLElement} */ (el).addEventListener('scroll', updateDuoFades, { passive: true });
		});
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
		document.addEventListener('click', onDocClick);
		document.addEventListener('keydown', onKey);
		const tick = window.setInterval(() => nowTick++, 30000);
		updateDuoFades();
		updateTop();
		// restore scroll / deep links
		let saved = null;
		try {
			saved = window.sessionStorage.getItem('blinca.v1.homeScroll');
		} catch {
			saved = null;
		}
		if (saved != null) {
			try {
				window.sessionStorage.removeItem('blinca.v1.homeScroll');
			} catch {
				/* noop */
			}
			const y = parseInt(saved, 10);
			if (!isNaN(y) && y > 0) {
				setTimeout(() => window.scrollTo(0, y), 60);
				return () => {
					window.removeEventListener('scroll', onScroll);
					window.removeEventListener('resize', onResize);
					document.removeEventListener('click', onDocClick);
					document.removeEventListener('keydown', onKey);
					window.clearInterval(tick);
				};
			}
		}
		if (q || window.location.hash === '#all-restaurants' || window.location.hash === '#kitchens')
			setTimeout(goAll, 60);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			document.removeEventListener('click', onDocClick);
			document.removeEventListener('keydown', onKey);
			window.clearInterval(tick);
		};
	});

	/* ---------- curated rails + catalogue stats ---------- */
	const openAll = $derived(allListed.filter((r) => r.status === 'open'));
	const RAIL_MAX = 10;
	const topRail = $derived(
		openAll
			.filter((r) => r.rating >= 4.6)
			.sort((a, b) => b.rating - a.rating)
			.slice(0, RAIL_MAX)
	);
	const fastRail = $derived(
		openAll
			.filter((r) => r.eta <= 45)
			.sort((a, b) => a.eta - b.eta)
			.slice(0, RAIL_MAX)
	);
	const freeRail = $derived(openAll.filter((r) => r.fee === 0).slice(0, RAIL_MAX));
	const avgRating = $derived.by(() => {
		const rated = allListed.filter((r) => r.rating > 0);
		return rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
	});
	const typicalEta = $derived.by(() => {
		const etas = openAll.map((r) => r.eta).sort((a, b) => a - b);
		return etas.length ? etas[Math.floor(etas.length / 2)] : 0;
	});
	/** @param {string} id */
	function pickCuisine(id) {
		const i = f.cuisines.indexOf(id);
		if (i === -1) f.cuisines.push(id);
		else f.cuisines.splice(i, 1);
		resetPaging();
		writeURL();
		if (f.cuisines.length) goAll();
	}
	/** @param {'top' | 'fast' | 'free'} k */
	function seeRail(k) {
		if (k === 'top') f.rating = 4.5;
		else if (k === 'fast') f.time = 45;
		else f.free = true;
		resetPaging();
		writeURL();
		goAll();
	}

	const resumeOrders = $derived(orders().slice(0, 2));
	const loc = $derived(lang() === 'sv' ? 'sv-SE' : 'en-GB');
	const helgOffer = $derived(activeOffers().find((o) => o.code === 'HELG'));
	const cartRest = $derived(cartRestaurant());
	const cartPricing = $derived(pricing());
	const cartN = $derived(count());
</script>

<Seo
	title={t('title.home')}
	description={m.seo_desc_home()}
	path="/"
	jsonLd={[
		organization(m.seo_desc_home()),
		website(m.seo_desc_home()),
		webPage({ title: t('title.home'), description: m.seo_desc_home(), path: '/' })
	]}
/>

<div class="wrap home2">
	<section class="hello">
		<div class="card hello-main">
			<p class="greet"><Icon name="clock" size={15} /><span>{clockLine}</span></p>
			<h1>{firstName ? t(greetingKey(), { name: firstName }) : t('h2.hi')} {t('h2.hungry')}</h1>
			<p class="sub">
				<Icon name="pin" size={15} />{address().street} · {helloEta
					? t('h2.eta', { n: helloEta })
					: t('h2.noneOpen')}
			</p>
			<SearchBox big initial={q} {onSearch} />
			<div class="intents">
				{#each INTENTS as it (it.id)}
					{@const n = intentItems(it).length}
					{#if n}
						<button class="intent" onclick={() => openIntent(it.id)}
							><i><Icon name={it.icon} size={16} cls={it.id === 'top' ? 'filled' : ''} /></i>{t(
								'h2.int.' + it.id
							)}<small>{it.kind === 'dish' ? t('h2.dishes', { n }) : t('h2.kitchens', { n })}</small
							></button
						>
					{/if}
				{/each}
			</div>
		</div>
		<div data-resume>
			<aside class="card resume" aria-label={t('h2.resume')}>
				<h2>{t('h2.resume')}</h2>
				{#if cartRest}
					{@const min = helgOffer?.rule.min || 0}
					{@const helgCode = helgOffer ? helgOffer.code : ''}
					{@const pct = min ? Math.min(100, Math.round((cartPricing.sub / min) * 100)) : 0}
					<button class="rc-cart" onclick={openCart}
						><span class="th"><Img src={cartRest.image} /></span><span class="grow"
							><strong>{cartRest.name}</strong>
							<small
								>{t('cart.items', { n: cartN })} · {prKr(
									cartPricing,
									cartPricing.sub
								)}{#if min}{' · '}{cartPricing.sub >= min
										? t('h2.freeUnlocked', { code: helgCode })
										: t('h2.toFree', { n: min - cartPricing.sub })}{/if}</small
							>
							{#if min}<span class="progress" aria-hidden="true"><b style="width:{pct}%"></b></span
								>{/if}</span
						></button
					>
					<a class="btn btn-primary btn-lg btn-block" href="/checkout"
						>{t('rest.goCheckout', { total: prKr(cartPricing, cartPricing.total) })}</a
					>
				{:else}
					<div class="rc-empty">
						<span class="empty-ic sm"><Icon name="cart" size={20} /></span>
						<div><strong>{t('cart.empty')}</strong><small>{t('h2.emptyHint')}</small></div>
					</div>
				{/if}
				{#if resumeOrders.length}
					<div class="rr-list">
						{#each resumeOrders as o (o.id)}
							{@const it0 = item(o.slug, o.items[0].itemId)}
							{@const rest0 = restaurant(o.slug)}
							<div class="rr">
								<span class="th sm"><Img src={it0 ? it0.image : null} /></span>
								<div class="grow">
									<strong
										>{o.items[0].qty}× {lineLabel(o.slug, o.items[0], lang())}{o.items.length > 1
											? ' ' + t('again.more', { n: o.items.length - 1 })
											: ''}</strong
									>
									<small>{rest0 ? rest0.name : ''} · {fmtDate(o.date, loc)} · {kr(o.amount)}</small>
								</div>
								<button class="btn btn-secondary btn-sm" onclick={() => reorderOrder(o.id)}
									>{t('home.reorder')}</button
								>
							</div>
						{/each}
					</div>
				{:else if !cartRest}
					<a class="btn btn-secondary btn-block" href="#all-restaurants">{t('cart.browse')}</a>
				{/if}
			</aside>
		</div>
	</section>

	<CuisineRail
		cuisines={D.cuisines}
		counts={cuisineCounts}
		selected={f.cuisines}
		onPick={pickCuisine}
	/>

	<section class="sec" aria-labelledby="mood-title">
		<div class="sec-head"><h2 class="h2" id="mood-title">{t('h2.moods')}</h2></div>
		<div class="moods">
			{#each D.moods as m (m.id)}
				{@const prices = (() => {
					/** @type {number[]} */
					const ps = [];
					moodRests(m).forEach((r) =>
						r.menu.forEach((c) => {
							if (c.id === 'drinks' || c.id === 'coffee') return;
							c.items.forEach((i) => ps.push(i.price));
						})
					);
					return ps;
				})()}
				{@const from = prices.length ? Math.min(...prices) : 0}
				<button
					class="mood"
					class:is-on={mood === m.id}
					onclick={() => pickMood(m.id)}
					aria-pressed={mood === m.id}
					><Img src={m.image} />
					<span class="mood-ic"><Icon name={m.icon} size={19} /></span><span class="mood-t"
						><strong>{L(m.name, lang())}</strong><span
							>{L(m.text, lang())}{from ? ' · ' + t('h2.from', { n: from }) : ''}</span
						></span
					>
					<span class="mood-go"><Icon name={mood === m.id ? 'check' : 'arrow'} size={17} /></span
					></button
				>
			{/each}
		</div>
	</section>

	<PromoBanners onBrowse={goAll} onMood={pickMood} />

	<RestaurantRail
		id="top"
		icon="star"
		title={t('home3.topTitle')}
		sub={t('home3.topSub')}
		list={topRail}
		onSeeAll={() => seeRail('top')}
	/>

	{#if sortedOffers.length || trendRows.length}
		<section
			class="sec duo"
			id="offers"
			style="--trend-rows:{duoRows}"
			class:duo-single={!trendRows.length || !sortedOffers.length}
		>
			{#if sortedOffers.length}
				<div>
					<div class="sec-head">
						<h2 class="h2">{t('h2.deals')}</h2>
						<button
							class="btn-link offers-seeall"
							class:has-new={hasNew()}
							onclick={openOffers}
							aria-label={hasNew()
								? `${t('home.seeAll', { n: sortedOffers.length })}. ${t('header.offersNew')}`
								: undefined}>{t('home.seeAll', { n: sortedOffers.length })}</button
						>
					</div>
					<div class="card deals-box">
						<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable) -->
						<div
							class="deals-scroll duo-scroll"
							tabindex="0"
							role="region"
							aria-label={t('h2.dealsRegion')}
						>
							{#each sortedOffers as o (offerKey(o))}
								{@const s = dealStatus(o)}
								<DealTicket
									offer={o}
									live={!!s.live}
									off={!!s.off}
									statusText={s.txt}
									isNew={offerIsNew(o)}
								/>
							{/each}
						</div>
					</div>
				</div>
			{/if}
			{#if trendRows.length}
				<div>
					<div class="sec-head">
						<h2 class="h2">{t('h2.trending')}</h2>
						<span class="count">{t('h2.lastHours')}</span>
					</div>
					<div class="card trend-card">
						<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable) -->
						<ol
							class="trend duo-scroll"
							tabindex="0"
							aria-label={t('h2.trendRegion')}
							class:is-open={trendOpen}
						>
							<TrendingList rows={trendRows} />
						</ol>
					</div>
					{#if trendRows.length > 3}
						<button
							class="btn-link trend-more"
							onclick={() => {
								trendOpen = !trendOpen;
							}}
						>
							{trendOpen ? t('home.showLess') : t('all.showAll', { n: trendRows.length })}
						</button>
					{/if}
				</div>
			{/if}
		</section>
	{/if}

	<RestaurantRail
		id="fast"
		icon="bike"
		title={t('home3.fastTitle')}
		sub={t('home3.fastSub')}
		list={fastRail}
		onSeeAll={() => seeRail('fast')}
	/>
	<RestaurantRail
		id="free"
		icon="tag"
		title={t('home3.freeTitle')}
		sub={t('home3.freeSub')}
		list={freeRail}
		onSeeAll={() => seeRail('free')}
	/>
</div>

<div class="all-band" id="all-restaurants">
	<div class="wrap">
		<div class="all-head">
			<h2 id="all-title">{t('home.all')} <span class="count">{totalLabel}</span></h2>
			<p class="all-sub">{t('all.subtitle', { open: openList.length, later: laterList.length })}</p>
		</div>
	</div>
	<div class="all-filterbar">
		<div class="wrap">
			<FilterBar
				{f}
				{activeCount}
				{view}
				{openPop}
				{cuisineCounts}
				allCuisines={D.cuisines}
				onOpenFilters={() => openFilters()}
				{onPop}
				onSort={(/** @type {string} */ s) => {
					f.sort = s;
					openPop = null;
					resetPaging();
					writeURL();
				}}
				onPrice={(/** @type {number} */ p) => {
					const i = f.price.indexOf(p);
					if (i === -1) f.price.push(p);
					else f.price.splice(i, 1);
					resetPaging();
					writeURL();
				}}
				onCuisine={(/** @type {string} */ c) => {
					const i = f.cuisines.indexOf(c);
					if (i === -1) f.cuisines.push(c);
					else f.cuisines.splice(i, 1);
					resetPaging();
					writeURL();
				}}
				onToggle={toggleQuick}
				onView={(/** @type {string} */ v) => {
					view = v;
					saveView(v);
					writeURL();
				}}
			/>
		</div>
	</div>
	<div class="wrap">
		{#if appliedItems.length}
			<div class="all-applied">
				<span>{showingLabel}</span>
				{#each appliedItems as [rk, label] (rk)}
					<Chip
						on
						small
						label={t('home.removeFilter', { name: label })}
						onclick={() => removeFilter(rk)}
					>
						{label}<Icon name="x" size={14} />
					</Chip>
				{/each}
				<button class="btn-link sm" onclick={clearAll}>{t('home.clearAll')}</button>
			</div>
		{/if}
		<div>
			{#if !filtered.length}
				<div class="empty">
					<span class="empty-ic"><Icon name="search" size={26} /></span>
					<h3>{t('home.emptyTitle')}</h3>
					<p>{t('home.emptyText')}</p>
					<button class="btn btn-primary" onclick={clearAll}>{t('home.clearAll')}</button>
				</div>
			{:else}
				{#if openList.length}
					<h3 class="all-group-h">{t('all.openNow', { n: openList.length })}</h3>
					{#if view === 'list'}
						{@const limL = (isPhone() ? 8 : 12) + Math.max(0, openPages - 1) * 12}
						<div class="all-later-grid">
							{#each openList.slice(0, limL) as r (r.slug)}<RestaurantRow {r} />{/each}
						</div>
						{#if openList.length > limL}
							{@const moreL = Math.min(12, openList.length - limL)}
							<div class="all-paging">
								<button
									class="btn btn-secondary"
									onclick={() => {
										openPages += 1;
										writeURL();
									}}>{t('home.showMore', { n: moreL })}</button
								>
								<p class="all-shown">
									{t('all.shownOf', { x: Math.min(limL, openList.length), y: openList.length })}
								</p>
							</div>
						{/if}
					{:else}
						{@const lim = (isPhone() ? 8 : 12) + Math.max(0, openPages - 1) * 12}
						<div class="all-open-grid">
							{#each openList.slice(0, lim) as r (r.slug)}<RestaurantCard {r} />{/each}
						</div>
						{#if openList.length > lim}
							{@const more = Math.min(12, openList.length - lim)}
							<div class="all-paging">
								<button
									class="btn btn-secondary"
									onclick={() => {
										openPages += 1;
										writeURL();
									}}>{t('home.showMore', { n: more })}</button
								>
								<p class="all-shown">
									{t('all.shownOf', { x: Math.min(lim, openList.length), y: openList.length })}
								</p>
							</div>
						{/if}
					{/if}
				{:else}
					<p class="all-note">{t('all.noneOpen')}</p>
				{/if}
				{#if laterList.length}
					{@const effectiveExpanded = laterExpanded || !openList.length}
					{@const vis = effectiveExpanded ? laterList : laterList.slice(0, 4)}
					<h3 class="all-group-h">{t('all.openingLater', { n: laterList.length })}</h3>
					<div class="all-later-grid">
						{#each vis as r (r.slug)}<RestaurantRow {r} />{/each}
					</div>
					{#if laterList.length > 4}
						<div class="all-more-wrap">
							<button
								class="btn btn-secondary"
								onclick={() => {
									laterExpanded = !laterExpanded;
									writeURL();
								}}
							>
								{effectiveExpanded ? t('home.showLess') : t('all.showAll', { n: laterList.length })}
							</button>
						</div>
					{/if}
				{/if}
			{/if}
		</div>
	</div>
</div>

<div class="wrap home-end">
	<WhyBlinca kitchens={allListed.length} rating={avgRating} eta={typicalEta} />
	<JoinBand />
</div>

<button
	class="all-top"
	hidden={!showTop}
	onclick={goAll}
	aria-label={t('all.backTop')}
	title={t('all.backTop')}
>
	<Glyph name="up" size={20} />
</button>
