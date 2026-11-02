<script>
	import { browser } from '#app/env';
	import { onMount } from 'svelte';
	import { page } from '#app/state';
	import Icon from '#lib/components/Icon.svelte';
	import SearchPanel from '#lib/components/desktop/SearchPanel.svelte';
	import LangMenu from '#lib/components/desktop/LangMenu.svelte';
	import AccountMenu from '#lib/components/desktop/AccountMenu.svelte';
	import AddressCard from '#lib/components/desktop/AddressCard.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { count, subtotal } from '#lib/stores/cart.svelte.js';
	import { openCart } from '#lib/ui.js';
	import { hasNew, activeOffers } from '#lib/stores/offers.svelte.js';

	/** @type {{ noCart?: boolean }} */
	let { noCart = false } = $props();

	const n = $derived(count());
	const total = $derived(subtotal());

	/* ---- nav links (active state from the current URL) ---- */
	const links = $derived.by(() => {
		const u = page.url;
		/* searchParams/hash are unavailable during static prerender — guard like +layout.svelte does. */
		const tab = browser ? u.searchParams.get('tab') : null;
		const hash = browser ? u.hash : '';
		return [
			{ label: t('nav.home'), href: '/', active: u.pathname === '/' && hash !== '#offers', dot: false },
			...(activeOffers().length
				? [{ label: t('nav.offers'), href: '/#offers', active: u.pathname === '/' && hash === '#offers', dot: hasNew() }]
				: []),
			{ label: t('nav.orders'), href: '/account?tab=orders', active: u.pathname === '/account' && tab === 'orders', dot: false },
			{ label: t('nav.help'), href: '/info/how', active: u.pathname.startsWith('/info'), dot: false }
		];
	});

	/* ---- tablet "Menu" dropdown ---- */
	let menuOpen = $state(false);
	/** @type {HTMLElement|null} */
	let menuWrap = $state(null);
	$effect(() => {
		if (!menuOpen) return;
		/** @param {MouseEvent} e */
		const onDoc = (e) => {
			if (menuWrap && e.target instanceof Node && !menuWrap.contains(e.target)) menuOpen = false;
		};
		document.addEventListener('click', onDoc);
		return () => document.removeEventListener('click', onDoc);
	});

	/* ---- search field + panel ---- */
	let query = $state('');
	let panelOpen = $state(false);
	let activeId = $state('');
	/** @type {HTMLInputElement|null} */
	let inputEl = $state(null);
	/** @type {HTMLElement|null} */
	let searchWrap = $state(null);
	/** @type {{ handleKey: (e: KeyboardEvent) => boolean } | null} */
	let panelRef = $state(null);

	function openPanel() {
		panelOpen = true;
	}
	function closePanel() {
		panelOpen = false;
		activeId = '';
	}
	/** @param {string} v */
	function setQuery(v) {
		query = v;
		panelOpen = true;
		inputEl?.focus();
	}

	/** @param {KeyboardEvent} e */
	function onInputKey(e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			closePanel();
			inputEl?.blur();
			return;
		}
		if (panelOpen && panelRef && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
			panelRef.handleKey(e);
		}
	}

	/* close on outside click */
	$effect(() => {
		if (!panelOpen) return;
		/** @param {MouseEvent} e */
		const onDoc = (e) => {
			if (searchWrap && e.target instanceof Node && !searchWrap.contains(e.target)) closePanel();
		};
		document.addEventListener('click', onDoc);
		return () => document.removeEventListener('click', onDoc);
	});

	/* close on route change */
	$effect(() => {
		void page.url.pathname;
		void page.url.search;
		closePanel();
	});

	/* scroll shadow + top-padding shrink; global "/" to open search */
	let scrolled = $state(false);
	onMount(() => {
		const onScroll = () => (scrolled = window.scrollY > 8);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });

		/** @param {KeyboardEvent} e */
		const onKey = (e) => {
			if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
			const el = /** @type {HTMLElement|null} */ (e.target);
			const tag = el?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
			e.preventDefault();
			openPanel();
			inputEl?.focus();
		};
		window.addEventListener('keydown', onKey);

		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('keydown', onKey);
		};
	});
	void browser;
</script>

<header class="island-wrap" class:scrolled>
	<div class="island" class:scrolled>
		<a class="logo" href="/" aria-label="Blinca – {t('nav.home')}">
			<img
				src="/img/logo.svg"
				alt="Blinca"
				width="120"
				height="38"
				onerror={(e) => {
					const img = /** @type {HTMLImageElement} */ (e.currentTarget);
					if (!img.dataset.fallback) {
						img.dataset.fallback = '1';
						img.src = '/img/logo.png';
					}
				}}
			/>
		</a>

		<!-- desktop inline links -->
		<nav class="nav-links" aria-label={t('nav.main')}>
			{#each links as l (l.href)}
				<a
					href={l.href}
					class="nav-link"
					class:active={l.active}
					aria-current={l.active ? 'page' : undefined}
					aria-label={l.dot ? t('header.offersNew') : undefined}
					>{l.label}{#if l.dot}<span class="nav-dot" aria-hidden="true"></span>{/if}</a
				>
			{/each}
		</nav>

		<!-- tablet menu dropdown -->
		<div class="nav-menu" bind:this={menuWrap}>
			<button
				class="menu-btn"
				class:has-dot={hasNew()}
				onclick={() => (menuOpen = !menuOpen)}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				aria-label={hasNew() ? `${t('nav.menu')} – ${t('header.offersNew')}` : t('nav.menu')}
			>
				<Icon name="sliders" size={18} /><span class="menu-lbl">{t('nav.menu')}</span><Icon name="down" size={14} cls="chev" />
			</button>
			{#if menuOpen}
				<div class="menu-pop" role="menu">
					{#each links as l (l.href)}
						<a
							role="menuitem"
							href={l.href}
							class:active={l.active}
							aria-label={l.dot ? t('header.offersNew') : undefined}
							onclick={() => (menuOpen = false)}
							>{l.label}{#if l.dot}<span class="nav-dot" aria-hidden="true"></span>{/if}</a
						>
					{/each}
				</div>
			{/if}
		</div>

		<!-- search -->
		<div class="search" class:focused={panelOpen} bind:this={searchWrap} role="search" aria-label={t('header.searchPlaceholder')}>
			<Icon name="search" size={19} cls="s-ic" />
			<input
				bind:this={inputEl}
				bind:value={query}
				type="search"
				class="s-input"
				autocomplete="off"
				placeholder={t('header.searchPlaceholder')}
				aria-label={t('header.searchPlaceholder')}
				aria-expanded={panelOpen}
				aria-controls="desktop-search-panel"
				aria-activedescendant={activeId || undefined}
				role="combobox"
				oninput={openPanel}
				onfocus={openPanel}
				onclick={openPanel}
				onkeydown={onInputKey}
			/>
			<kbd class="kbd" aria-hidden="true">/</kbd>
			{#if panelOpen}
				<div id="desktop-search-panel">
					<SearchPanel bind:this={panelRef} {query} {setQuery} close={closePanel} bind:activeId />
				</div>
			{/if}
		</div>

		<div class="spacer"></div>

		<AddressCard />
		<span class="divider" aria-hidden="true"></span>
		<LangMenu />
		<AccountMenu />

		{#if !noCart}
			<!-- The name must contain the visible text (count and total) -->
			<button
				class="cart"
				onclick={openCart}
				aria-label={n ? `${t('header.cart')} ${n} ${total} kr` : t('header.cart')}
			>
				<Icon name="cart" size={20} />
				{#if n}
					<span class="cart-n">{n}</span>
					<span class="cart-total">{total} kr</span>
				{:else}
					<span class="cart-total">{t('header.cart')}</span>
				{/if}
			</button>
		{/if}
	</div>
</header>

<style>
	/* hidden on phone; the legacy .hdr handles ≤760px */
	.island-wrap {
		display: none;
	}

	@media (min-width: 761px) {
		.island-wrap {
			display: block;
			position: sticky;
			top: 0;
			z-index: 60;
			padding: 14px 20px 0;
			background: transparent;
			transition: padding 0.2s ease;
		}
		.island-wrap.scrolled {
			padding-top: 8px;
		}
		.island {
			display: flex;
			align-items: center;
			gap: 8px;
			height: 68px;
			padding: 0 10px 0 20px;
			background: rgba(255, 255, 255, 0.94);
			border: 1px solid var(--border);
			border-radius: 22px;
			box-shadow:
				0 2px 4px rgba(60, 20, 20, 0.04),
				0 12px 32px rgba(60, 20, 20, 0.08);
			backdrop-filter: blur(10px);
			-webkit-backdrop-filter: blur(10px);
			transition: box-shadow 0.2s ease;
		}
		.island.scrolled {
			box-shadow:
				0 2px 6px rgba(60, 20, 20, 0.08),
				0 18px 44px rgba(60, 20, 20, 0.14);
		}
	}

	.logo {
		display: flex;
		flex: none;
	}
	.logo img {
		width: 120px;
		height: auto;
		display: block;
	}

	/* nav links */
	.nav-links {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: 6px;
	}
	.nav-link {
		position: relative;
		flex: none;
		white-space: nowrap;
		padding: 8px 12px;
		font-size: 14.5px;
		font-weight: 600;
		color: var(--text-2);
		border-radius: 10px;
	}
	.nav-link:hover {
		color: var(--text);
		background: var(--bg);
	}
	.nav-link.active {
		color: var(--text);
	}
	.nav-link.active::after {
		content: '';
		position: absolute;
		left: 14px;
		right: 14px;
		bottom: 2px;
		height: 3px;
		border-radius: 3px;
		background: var(--brand);
	}
	.nav-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		margin-left: 5px;
		border-radius: 50%;
		background: var(--brand);
		vertical-align: middle;
	}
	.menu-btn.has-dot::after {
		content: '';
		position: absolute;
		top: 8px;
		right: 8px;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--brand);
	}

	/* tablet menu (hidden on wide desktop) */
	.nav-menu {
		display: none;
		position: relative;
		flex: none;
	}
	.menu-btn {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		height: 44px;
		padding: 0 12px;
		border-radius: 14px;
		font-size: 14.5px;
		font-weight: 600;
		color: var(--text-2);
	}
	.menu-btn:hover {
		background: var(--bg);
		color: var(--text);
	}
	.menu-btn :global(.chev) {
		color: var(--muted);
	}
	.menu-pop {
		position: absolute;
		left: 0;
		top: calc(100% + 10px);
		z-index: 80;
		min-width: 190px;
		padding: 8px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: 0 16px 40px rgba(60, 20, 20, 0.16);
		display: flex;
		flex-direction: column;
	}
	.menu-pop a {
		padding: 10px 12px;
		min-height: 44px;
		display: flex;
		align-items: center;
		border-radius: 10px;
		font-size: 14.5px;
		font-weight: 600;
		color: var(--text-2);
	}
	.menu-pop a:hover {
		background: var(--bg);
		color: var(--text);
	}
	.menu-pop a.active {
		color: var(--brand-dark);
	}

	/* search field */
	.search {
		position: relative;
		display: flex;
		align-items: center;
		flex: 4 1 320px;
		min-width: 220px;
		max-width: 520px;
		height: 46px;
		margin-left: 20px;
		padding: 0 10px 0 42px;
		border-radius: 14px;
		background: var(--field);
		border: 1px solid transparent;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.search.focused {
		background: #fff;
		border-color: var(--pink-border);
		box-shadow: 0 0 0 4px rgba(226, 55, 68, 0.15);
	}
	.search :global(.s-ic) {
		position: absolute;
		left: 14px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--muted);
		pointer-events: none;
	}
	.s-input {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 0;
		box-shadow: none;
		outline: none;
		font-size: 14.5px;
		color: var(--text);
	}
	.s-input:focus {
		border: 0;
		box-shadow: none;
	}
	.s-input::placeholder {
		color: var(--muted);
	}
	.kbd {
		flex: none;
		display: grid;
		place-items: center;
		min-width: 22px;
		height: 22px;
		padding: 0 5px;
		background: #fff;
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 700;
		color: var(--muted);
	}

	.spacer {
		flex: 1 1 0;
	}
	.divider {
		width: 1px;
		height: 28px;
		background: var(--border);
		flex: none;
		margin: 0 2px;
	}

	/* cart */
	.cart {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 46px;
		padding: 0 16px;
		border-radius: 14px;
		background: var(--brand-dark);
		color: #fff;
		font-size: 14.5px;
		font-weight: 700;
		box-shadow: 0 6px 16px rgba(179, 33, 47, 0.28);
		flex: none;
		transition: background-color 0.15s;
	}
	.cart:hover {
		background: var(--brand-hover);
	}
	.cart-n {
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.22);
		font-size: 12.5px;
		font-weight: 700;
		line-height: 22px;
		text-align: center;
	}

	/* The four labels (longer in Swedish) would squeeze the search, so they fold into "Menu" below 1500px. */
	@media (max-width: 1499px) {
		.nav-links {
			display: none;
		}
		.nav-menu {
			display: block;
		}
	}

	/* ---- tablet (761–1080) ---- */
	@media (max-width: 1080px) {
		.kbd {
			display: none;
		}
		.search {
			flex: 1;
			min-width: 0;
			margin-left: 12px;
		}
		.spacer {
			display: none;
		}
		.cart-total {
			display: none;
		}
		.cart {
			padding: 0 14px;
		}
	}
	@media (max-width: 900px) {
		.menu-lbl,
		.divider {
			display: none;
		}
		.island {
			gap: 6px;
		}
		.search {
			margin-left: 6px;
		}
	}
</style>
