<script>
	import Icon from '#lib/components/Icon.svelte';
	import AddressButton from '#lib/components/AddressButton.svelte';
	import SearchBox from '#lib/components/SearchBox.svelte';
	import LangMenu from '#lib/components/LangMenu.svelte';
	import AccountMenu from '#lib/components/AccountMenu.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { count } from '#lib/stores/cart.svelte.js';
	import { openCart } from '#lib/ui.js';

	/** @type {{ noCart?: boolean }} */
	let { noCart = false } = $props();

	const n = $derived(count());
</script>

<header id="site-header" class="hdr" class:no-cart={noCart}>
	<div class="wrap hdr-in">
		<a class="logo" href="/" aria-label="Blinca – {t('nav.home')}"
			><img class="logo-svg" src="/img/logo.svg" alt="blinca" width="160" height="50" /></a
		>
		<AddressButton />
		<SearchBox />
		<LangMenu />
		<AccountMenu />
		{#if !noCart}
			<button class="icon-btn" onclick={openCart} aria-label={n ? `${t('header.cart')} ${n}` : t('header.cart')}
				><Icon name="cart" size={21} /><span class="badge" hidden={!n}>{n}</span></button
			>
		{/if}
	</div>
</header>
