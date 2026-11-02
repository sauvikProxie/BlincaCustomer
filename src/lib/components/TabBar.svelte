<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { user } from '#lib/stores/user.svelte.js';
	import { count } from '#lib/stores/cart.svelte.js';
	import { openSearchSheet, logout } from '#lib/ui.js';

	/** @type {{ active: string }} */
	let { active } = $props();

	const u = $derived(user());
	const n = $derived(count());
</script>

<nav class="tabbar" aria-label={t('nav.main')}>
	<a href="/" class:is-here={active === 'home'}
		><span class="tb-ic"><Icon name="home" size={22} /></span><span>{t('nav.home')}</span></a
	>
	<button onclick={openSearchSheet} aria-label={t('nav.search')}
		><span class="tb-ic"><Icon name="search" size={22} /></span><span>{t('nav.search')}</span></button
	>
	<a href="/account?tab=orders" class:is-here={active === 'orders'}
		><span class="tb-ic"><Icon name="receipt" size={22} /></span><span>{t('acc.orders')}</span></a
	>
	<a href="/account" class:is-here={active === 'account'}
		><span class="tb-ic"><Icon name="user" size={22} /></span><span>{t('header.account')}</span></a
	>
	{#if u}
		<button onclick={logout} aria-label={t('acct.logout')}
			><span class="tb-ic"><Icon name="logout" size={22} /></span><span>{t('acct.logout')}</span
			></button
		>
	{/if}
</nav>
