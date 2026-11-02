<script>
	import { browser } from '#app/env';
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import AddControl from '#lib/components/AddControl.svelte';
	import DishCard from '#lib/components/DishCard.svelte';
	import Stepper from '#lib/components/Stepper.svelte';
	import PromoBox from '#lib/components/PromoBox.svelte';
	import Totals from '#lib/components/Totals.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { restaurant, restaurantGone, item, ensureMenu, menuFailed } from '#lib/stores/catalog.svelte.js';
	import { useLiveRestaurant } from '#lib/stores/liveRestaurant.svelte.js';
	import {
		cart,
		cartRestaurant,
		count,
		subtotal,
		lineTotal,
		changeQty,
		pricing,
		deliveryMode,
		setDeliveryMode,
		itemQty
	} from '#lib/stores/cart.svelte.js';
	import { orders, reorderOrder, lineLabel } from '#lib/stores/orders.svelte.js';
	import { isFav } from '#lib/stores/favourites.svelte.js';
	import { norm, cuisineNames, priceLevel, L, kr, decimal, prKr, restaurantUrl, dayRanges, fmtDate } from '#lib/format.js';
	import { requestAdd, toggleFav, copyCode, openCart } from '#lib/ui.js';
	import { openModal } from '#lib/layers.svelte.js';
	import HoursDialog from '#lib/components/HoursDialog.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { restaurant as restaurantJsonLd } from '#lib/seo/jsonld.js';
	import { restaurantDescription } from '#lib/seo/description.js';

	/** @type {{ data: { slug: string, seo: import('./$types').PageServerData['seo'] } }} */
	let { data } = $props();

	// Menu, stock, prices and status stay live while the page is open (real mode).
	useLiveRestaurant(() => data.slug);
	const r = $derived(restaurant(data.slug));
	// The list only has lightweight dishes; the load in +page.ts can run before the list is set, so make sure the full menu (sizes, options) is here.
	$effect(() => {
		if (r) void ensureMenu(r.slug);
	});
	const fav = $derived(r ? isFav(r.slug) : false);
	const mode = $derived(deliveryMode());

	let fq = $state('');
	let fveg = $state(false);
	let fspicy = $state(false);
	/** @type {string|null} */
	let active = $state(null);
	let lockSpy = $state(false);

	const secs = $derived.by(() => {
		/** @type {any[]} */
		const empty = [];
		if (!r) return empty;
		const pop = (r.popular || []).map((id) => item(r.slug, id)).filter(Boolean);
		/** @type {Array<{ id: string, name: string, items: any[], popular?: boolean }>} */
		const list = pop.length
			? [{ id: 'popular', name: t('rest.popular'), items: pop, popular: true }]
			: [];
		r.menu.forEach((c) => list.push({ id: c.id, name: L(c.name, lang()), items: c.items }));
		return list;
	});
	const past = $derived(r ? orders().filter((o) => o.slug === r.slug).slice(0, 3) : []);

	/** @param {any} it */
	function matches(it) {
		if (fveg && !(it.tags || []).includes('vegetarian')) return false;
		if (fspicy && !(it.tags || []).includes('spicy')) return false;
		if (fq) {
			const q = norm(fq);
			return (
				norm(it.name.en).includes(q) || norm(it.name.sv).includes(q) || norm(L(it.desc, lang())).includes(q)
			);
		}
		return true;
	}
	const visibleSecs = $derived(secs.filter((s) => s.items.some(matches)));
	const anyVisible = $derived(visibleSecs.length > 0);
	const showPast = $derived(past.length > 0 && !fq && !fveg && !fspicy);

	/** @type {{ rating: string, reviews: number }} */
	const meta = $derived(
		r ? { rating: r.rating.toFixed(1), reviews: r.reviews } : { rating: '', reviews: 0 }
	);

	// Today's hours, following a special day when one is set; null = closed.
	const todayHours = $derived(r ? (dayRanges(r, new Date())[0] ?? null) : null);
	function headerOffset() {
		if (!browser) return 0;
		const h = document.getElementById('site-header');
		const c = document.querySelector('.rest .cat-chips');
		const chipsH =
			c && c instanceof HTMLElement && c.offsetParent && getComputedStyle(c).display !== 'none'
				? c.offsetHeight
				: 0;
		return (h ? h.offsetHeight : 0) + chipsH + 16;
	}

	/** @param {string} id */
	/** @param {string|null} id */
	function setActive(id) {
		if (id === active) return;
		active = id;
		if (!browser) return;
		document.querySelectorAll('.rest [data-nav]').forEach((a) => {
			const el = /** @type {HTMLElement} */ (a);
			const on = el.getAttribute('data-nav') === id;
			el.classList.toggle('is-on', on);
			if (on && el.classList.contains('chip') && el.parentNode instanceof HTMLElement) {
				el.parentNode.scrollTo({ left: el.offsetLeft - 60, behavior: 'smooth' });
			}
		});
	}

	function onScroll() {
		if (lockSpy || !r || !browser) return;
		const list = document.querySelectorAll('.rest [data-sec]');
		if (!list.length) return;
		const off = headerOffset() + 40;
		let cur = list[0].getAttribute('data-sec');
		list.forEach((s) => {
			if (s.getBoundingClientRect().top <= off) cur = s.getAttribute('data-sec');
		});
		if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4)
			cur = list[list.length - 1].getAttribute('data-sec');
		setActive(cur);
	}

	/** @param {string} id */
	function goTo(id) {
		const el = document.getElementById('cat-' + id);
		if (!el || !browser) return;
		setActive(id);
		lockSpy = true;
		window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerOffset()), behavior: 'smooth' });
		setTimeout(() => (lockSpy = false), 800);
	}

	function openHours() {
		if (!r) return;
		openModal(HoursDialog, { slug: r.slug }, { label: t('rest.hoursTitle') });
	}

	function share() {
		if (!browser || !r) return;
		const url = window.location.href.split('#')[0];
		if (navigator.share) navigator.share({ title: r.name, url }).catch(() => {});
		else copyCode(url, t('rest.linkCopied'));
	}

	function resetFilter() {
		fq = '';
		fveg = false;
		fspicy = false;
	}

	function focusSearch() {
		if (!browser) return;
		const i = document.querySelector('.rest [data-msearch]');
		if (i instanceof HTMLElement) {
			i.scrollIntoView({ block: 'center', behavior: 'smooth' });
			i.focus({ preventScroll: true });
		}
	}

	onMount(() => {
		if (!active && secs.length) setActive(secs[0].id);
		window.addEventListener('scroll', onScroll, { passive: true });
		if (browser && /^#item-/.test(window.location.hash)) {
			const target = document.getElementById(window.location.hash.slice(1));
			if (target)
				setTimeout(() => {
					window.scrollTo({
						top: target.getBoundingClientRect().top + window.scrollY - headerOffset() - 10
					});
					target.classList.add('is-flash');
					setTimeout(() => target.classList.remove('is-flash'), 1800);
				}, 80);
		}
		return () => window.removeEventListener('scroll', onScroll);
	});

	const sideLines = $derived(cart());
	const sideRest = $derived(cartRestaurant());
	const sidePr = $derived(pricing());
	// Zone/restaurant minimum from the preview when it is about this
	// restaurant (the preview prices the cart's restaurant), else the
	// restaurant's fallback — the cheapest zone's.
	const minOrder = $derived(
		sideRest?.slug === r?.slug ? (sidePr.min ?? r?.minOrder ?? 0) : (r?.minOrder ?? 0)
	);
	const cartN = $derived(count());

	const seoDescription = $derived.by(() => {
		if (!r) return m.seo_desc_home();
		return restaurantDescription(
			{ name: r.name, cuisines: cuisineNames(r, lang()), city: r.city },
			{
				full: m.seo_desc_restaurant,
				noCity: m.seo_desc_restaurant_nocity,
				noCuisine: m.seo_desc_restaurant_nocuisine,
				bare: m.seo_desc_restaurant_bare
			}
		);
	});
	const seoJsonLd = $derived.by(() => {
		const s = data.seo;
		if (!r || !s) return [];
		return [
			restaurantJsonLd({
				name: r.name,
				path: `/restaurants/${r.slug}`,
				imageUrl: s.imageUrl ?? undefined,
				servesCuisine: r.cuisines.map((c) => cuisineNames({ cuisines: [c] }, lang())).filter(Boolean),
				telephone: s.phone ?? undefined,
				address: { streetAddress: s.address, addressLocality: s.city, postalCode: s.postalCode },
				weeklyHours: s.weekly,
				specialDays: s.specialDays
			})
		];
	});
</script>

<Seo
	title="{r ? r.name : t('rest.notFound')} – Blinca"
	description={seoDescription}
	path="/restaurants/{data.slug}"
	image={r?.image}
	type="restaurant.restaurant"
	noindex={!r}
	jsonLd={seoJsonLd}
/>

{#if !r && !restaurantGone(data.slug)}
	<div class="wrap narrow pad-y"><p class="muted">{m.loading()}</p></div>
{:else if !r}
	<div class="wrap narrow pad-y">
		<div class="empty">
			<span class="empty-ic"><Icon name="search" size={26} /></span>
			<h1>{t('rest.notFound')}</h1>
			<p>{t('rest.notFoundText')}</p>
			<a class="btn btn-primary" href="/">{t('nav.home')}</a>
		</div>
	</div>
{:else}
	<div class="wrap rest">
		<nav class="crumb" aria-label={m.breadcrumb_label()}>
			<a href="/">{t('nav.home')}</a><Icon name="right" size={14} />
			<a href="/#all-restaurants">{t('rest.restaurants')}</a><Icon name="right" size={14} />
			<b aria-current="page">{r.name}</b>
		</nav>

		<section class="card rhero">
			<div class="cv">
				<Img src={r.image} alt={r.name} />
				<a class="icon-btn sm white back-btn" href="/" aria-label={t('common.back')}
					><Icon name="left" size={18} /></a
				>
				<div class="acts">
					<button
						class="icon-btn sm white"
						class:is-on={fav}
						onclick={() => toggleFav(r.slug)}
						aria-pressed={fav}
						aria-label={t('fav.label', { name: r.name })}><Icon name="heart" size={17} /></button
					>
					<button class="icon-btn sm white" onclick={share} aria-label={t('rest.share')}
						><Icon name="share" size={17} /></button
					>
					<button class="icon-btn sm white" onclick={openHours} aria-label={t('rest.info')}
						><Icon name="info" size={17} /></button
					>
				</div>
				<div class="idn">
					<span class="avatar"><span>{r.name.charAt(0)}</span></span>
					<div>
						<h1>{r.name}</h1>
						<p class="m">
							{#if r.reviews > 0}<span class="rate"
									><Icon name="star" size={15} />{meta.rating}
									<span>({t('rest.reviews', { n: r.reviews })})</span></span
								><i class="dot"></i>{/if}{cuisineNames(r, lang())}<i class="dot"></i>{priceLevel(
								r.priceLevel
							)}{#if r.km}<i class="dot"></i>{String(r.km).replace(
									'.',
									lang() === 'sv' ? ',' : '.'
								)}
								km{/if}
						</p>
						{#if /** @type {any} */ (r).desc && L(/** @type {any} */ (r).desc, lang())}
							<p class="rdesc">{L(/** @type {any} */ (r).desc, lang())}</p>
						{/if}
					</div>
				</div>
			</div>
			<div class="idn-m">
				<span class="avatar sm"><span>{r.name.charAt(0)}</span></span>
				<div>
					<h1>{r.name}</h1>
					<p class="m">
						{#if r.reviews > 0}<span class="rate"
								><Icon name="star" size={15} />{meta.rating}
								<span>({t('rest.reviews', { n: r.reviews })})</span></span
							><i class="dot"></i>{/if}{cuisineNames(r, lang())}<i class="dot"></i>{priceLevel(r.priceLevel)}{#if r.km}<i
								class="dot"
							></i>{String(r.km).replace('.', lang() === 'sv' ? ',' : '.')}
							km{/if}
					</p>
				</div>
			</div>
			<div class="stats">
				<div class="stat">
					<small>{t('rest.status')}</small>
					<strong class:muted={r.status !== 'open'}>
						{#if r.status === 'open'}<span class="live"></span>{:else}<Icon
								name={r.status === 'paused' ? 'pause' : 'clock'}
								size={15}
							/>{/if}
						{r.status === 'open'
							? t('rest.openCloses', { time: r.closesAt })
							: r.status === 'paused'
								? t('rest.paused')
								: t('rest.closedOpens', { time: r.opensAt })}
					</strong>
				</div>
				<div class="stat">
					<small>{t('co.delivery')}</small><strong
						>{t('common.minRange', { a: r.eta, b: r.eta + 10 })}</strong
					>
				</div>
				<div class="stat">
					<small>{t('co.deliveryFee')}</small><strong
						>{r.fee ? kr(r.fee) : t('rest.free')}</strong
					>
				</div>
				{#if minOrder}
					<div class="stat"><small>{t('rest.minOrder')}</small><strong>{kr(minOrder)}</strong></div>
				{/if}
				<div class="seg mode-seg" role="radiogroup" aria-label={t('co.delOrPick')}>
					<button
						role="radio"
						aria-checked={mode === 'delivery'}
						class:is-on={mode === 'delivery'}
						onclick={() => setDeliveryMode('delivery')}
						><Icon name="bike" size={17} />{t('co.delivery')}</button
					>
					<button
						role="radio"
						aria-checked={mode === 'pickup'}
						class:is-on={mode === 'pickup'}
						onclick={() => setDeliveryMode('pickup')}
						><Icon name="walk" size={17} />{t('rest.pickupEta', { n: r.pickupEta })}</button
					>
				</div>
			</div>
		</section>

		<div class="rlay">
			<nav class="card rail" aria-label={t('rest.menu')}>
				<p class="rail-label">{t('rest.menu')}</p>
				{#each secs as s (s.id)}
					<a
						href="#cat-{s.id}"
						class:is-on={active === s.id}
						onclick={(e) => {
							e.preventDefault();
							goTo(s.id);
						}}>{s.name}<span>{s.items.length}</span></a
					>
				{/each}
				{#if past.length}
					<a
						href="#cat-again"
						onclick={(e) => {
							e.preventDefault();
							goTo('again');
						}}>{t('rest.orderAgain')}<span>{past.length}</span></a
					>
				{/if}
				<div class="rail-info">
					{#if todayHours}
						<span><Icon name="clock" size={16} />{todayHours[0] === '00:00' && todayHours[1] === '00:00'
								? t('rest.open24')
								: t('rest.todayHours', { a: todayHours[0], b: todayHours[1] })}</span>
					{/if}
					<span><Icon name="pin" size={16} />{r.address.split(',')[0]}</span>
					<button class="btn-link sm" onclick={openHours}>{t('rest.seeHours')}</button>
				</div>
			</nav>
			<div class="rmain">
				<div class="cat-chips" role="navigation" aria-label={t('rest.menu')}>
					<button class="icon-btn sm outline" onclick={focusSearch} aria-label={t('rest.searchMenu')}
						><Icon name="search" size={17} /></button
					>
					{#each secs as s (s.id)}
						<button
							class="chip"
							class:is-on={active === s.id}
							onclick={() => goTo(s.id)}>{s.name}</button
						>
					{/each}
				</div>
				<div class="mtools">
					<div class="pill-search lg">
						<Icon name="search" size={18} /><input
							type="search"
							data-msearch
							placeholder={t('rest.searchIn', { name: r.name })}
							aria-label={t('rest.searchMenu')}
							value={fq}
							oninput={(e) => (fq = e.currentTarget.value)}
						/>
					</div>
					<button
						class="chip"
						class:is-on={fveg}
						aria-pressed={fveg}
						onclick={() => (fveg = !fveg)}><Icon name="leaf" size={16} />{t('tag.vegetarian')}</button
					>
					<button
						class="chip"
						class:is-on={fspicy}
						aria-pressed={fspicy}
						onclick={() => (fspicy = !fspicy)}><Icon name="flame" size={16} />{t('tag.spicy')}</button
					>
				</div>
				{#if r.status !== 'open'}
					<div class="note-banner">
						<Icon name={r.status === 'paused' ? 'pause' : 'clock'} size={18} />
						{r.status === 'paused'
							? t('rest.pausedBanner')
							: t('rest.closedBanner', { time: r.opensAt })}
					</div>
				{/if}
				<div>
					{#if menuFailed(r.slug) && /** @type {any} */ (r)._lite}
						<div class="empty" role="alert" data-testid="menu-error">
							<span class="empty-ic"><Icon name="info" size={26} /></span>
							<p>{m.error_body()}</p>
							<button class="btn btn-primary" onclick={() => ensureMenu(r.slug)}>{m.error_retry()}</button>
						</div>
					{:else if !anyVisible}
						<div class="empty">
							<span class="empty-ic"><Icon name="search" size={26} /></span>
							<h3>{t('rest.noMatch')}</h3>
							<p>{t('rest.noMatchText')}</p>
							<button class="btn btn-secondary" onclick={resetFilter}>{t('rest.clearSearch')}</button>
						</div>
					{:else}
						{#each visibleSecs as s (s.id)}
							{@const items = s.items.filter(matches)}
							<section class="msec" id="cat-{s.id}" data-sec={s.id}>
								<div class="msec-h">
									<h2 class="h2">{s.name}</h2><span class="count"
										>{s.popular
											? t('rest.popularSub')
											: s.id === 'lunch'
												? t('rest.lunchSub')
												: t('rest.dishes', { n: items.length })}</span
									>
								</div>
								<div class={s.popular ? 'pop3' : 'mgrid'}>
									{#each items as it, i (`${s.id}|${it.id}`)}
										<DishCard slug={r.slug} item={it} popular={!!s.popular} rank={i + 1} />
									{/each}
								</div>
							</section>
						{/each}
					{/if}
					{#if showPast}
						<section class="msec" id="cat-again" data-sec="again">
							<div class="msec-h"><h2 class="h2">{t('rest.orderAgain')}</h2></div>
							<div class="card list-card">
								{#each past as o (o.id)}
									{@const items = o.items
										.map((ii) => ii.qty + '× ' + lineLabel(o.slug, ii, lang()))
										.join(', ')}
									<div class="list-row">
										<div class="grow">
											<strong>{items}</strong><small
												>{fmtDate(o.date, lang())}
												· {kr(o.amount)}</small
											>
										</div>
										<button class="btn btn-secondary btn-sm" onclick={() => reorderOrder(o.id)}
											>{t('home.reorder')}</button
										>
									</div>
								{/each}
							</div>
						</section>
					{/if}
				</div>
			</div>
			<aside class="card side-cart" aria-label={t('co.yourOrder')}>
				<div class="sc-head">
					<h2 class="h3">{t('co.yourOrder')}</h2>
					<span class="tag"
						><Icon name={mode === 'delivery' ? 'bike' : 'walk'} size={13} />{mode === 'delivery'
							? t('co.delivery')
							: t('co.pickup')}</span
					>
				</div>
				{#if !sideLines.length}
					<div class="sc-empty">
						<span class="empty-ic sm"><Icon name="cart" size={22} /></span>
						<strong>{t('rest.orderEmpty')}</strong>
						<p>{t('rest.orderEmptyText')}</p>
					</div>
				{:else if sideRest.slug !== r.slug}
					<div class="sc-empty">
						<p>{t('rest.otherCart', { name: sideRest.name })}</p>
						<button class="btn btn-secondary btn-sm" onclick={openCart}>{t('rest.viewCart')}</button>
					</div>
				{:else}
					{#each sideLines as l (l.key)}
						{@const it = item(l.slug, l.itemId)}
						{@const sub = (() => {
							/** @type {string[]} */
							const parts = [];
							(it.options || []).forEach((g) => {
								const ch = l.opts[g.id] || [];
								g.choices.forEach((c) => {
									if (ch.includes(c.id)) parts.push(L(c.name, lang()));
								});
							});
							const o = parts.join(', ');
							return o + (l.note ? (o ? ' · ' : '') + '“' + l.note + '”' : '');
						})()}
						<div class="sc-line">
							<div>
								<strong>{L(it.name, lang())}</strong>
								{#if sub}<small>{sub}</small>{/if}
							</div>
							<b>{kr(lineTotal(l))}</b>
							<Stepper
								qty={l.qty}
								decLabel={t('qty.less', { name: L(it.name, lang()) })}
								incLabel={t('qty.more', { name: L(it.name, lang()) })}
								onDec={() => changeQty(l.key, -1)}
								onInc={() => changeQty(l.key, 1)}
							/>
							<button class="btn-link muted sm" onclick={() => changeQty(l.key, -l.qty)}
								>{t('cart.remove')}</button
							>
						</div>
					{/each}
					{@const pr = sidePr}
					<div class="sc-totals">
						<div class="sum-row" class:pr-stale={pr.stale}><span>{t('cart.subtotal')}</span><span>{prKr(pr, pr.sub)}</span></div>
						{#if pr.mode === 'delivery'}
							<div class="sum-row" class:pr-stale={pr.stale}><span>{t('co.deliveryFee')}</span><span>{prKr(pr, pr.fee)}</span></div>
						{/if}
						{#if pr.discount && pr.promo}
							<div class="sum-row good" class:pr-stale={pr.stale}>
								<span>{t('promo.discount')} ({pr.promo.code})</span><span>−{kr(pr.discount)}</span>
							</div>
						{/if}
						<div class="sum-total" class:pr-stale={pr.stale}><span>{t('co.total')}</span><span>{prKr(pr, pr.total)}</span></div>
						{#if !pr.loading}<p class="vat" class:pr-stale={pr.stale}>{t('co.vat', { vat: decimal(pr.vat) })}</p>{/if}
					</div>
					{#if minOrder && pr.sub < minOrder}
						<p class="form-err">{t('rest.minLeft', { n: minOrder - pr.sub })}</p>
					{/if}
					<a
						class="btn btn-primary btn-lg btn-block mt-12"
						class:is-disabled={minOrder && pr.sub < minOrder}
						aria-disabled={!!(minOrder && pr.sub < minOrder)}
						href="/checkout"
						onclick={(e) => {
							if (minOrder && pr.sub < minOrder) e.preventDefault();
						}}>{t('rest.goCheckout', { total: prKr(pr, pr.total) })}</a
					>
				{/if}
			</aside>
		</div>
	</div>
	{#if cartN && sideRest}
		<button class="cart-bar" onclick={openCart}
			><span class="cb-n">{cartN}</span><span class="grow">{t('rest.viewCart')}</span><span
				class="cb-tot">{kr(subtotal())}</span
			></button
		>
	{/if}
{/if}
