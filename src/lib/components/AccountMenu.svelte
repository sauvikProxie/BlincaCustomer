<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { user } from '#lib/stores/user.svelte.js';
	import { setLang } from '#lib/stores/language.svelte.js';
	import { logout } from '#lib/ui.js';
	import { infoUrl } from '#lib/format.js';

	let open = $state(false);
	/** @type {HTMLElement|null} */
	let wrap = $state(null);
	const u = $derived(user());

	/** @type {HTMLButtonElement|null} */
	let btn = $state(null);

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		if (e.key === 'Escape' && open) {
			open = false;
			btn?.focus();
		}
	}

	$effect(() => {
		if (!open) return;
		/** @param {MouseEvent} e */
		const onDoc = (e) => {
			if (wrap && e.target instanceof Node && !wrap.contains(e.target)) open = false;
		};
		document.addEventListener('click', onDoc);
		return () => document.removeEventListener('click', onDoc);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (Escape bubbles from the menu's own controls) -->
<div class="pop-wrap" bind:this={wrap} onkeydown={onKey}>
	<button
		bind:this={btn}
		class="icon-btn"
		onclick={() => (open = !open)}
		aria-haspopup="true"
		aria-expanded={open}
		aria-label={t('header.account')}><Icon name="user" size={20} /></button
	>
	<div class="menu acct-menu" role="menu" hidden={!open}>
		{#if !u}
			<a href="/login"><Icon name="user" size={18} />{t('acct.login')}</a>
			<div class="menu-sep"></div>
			<a href={infoUrl('how')}><Icon name="info" size={18} />{t('nav.how')}</a>
			<a href={infoUrl('about')}><Icon name="heart" size={18} />{t('nav.about')}</a>
			<a href={infoUrl('contact')}><Icon name="help" size={18} />{t('nav.contact')}</a>
		{:else}
			<div class="menu-user"><strong>{u.name}</strong><span>{u.email}</span></div>
			<a href="/account"><Icon name="user" size={18} />{t('acc.profile')}</a>
			<a href="/account?tab=orders"><Icon name="receipt" size={18} />{t('acc.orders')}</a>
			<a href="/account?tab=favourites"><Icon name="heart" size={18} />{t('acc.favourites')}</a>
			<a href="/account?tab=addresses"><Icon name="pin" size={18} />{t('acc.addresses')}</a>
			<div class="menu-sep"></div>
			<a href={infoUrl('how')}><Icon name="info" size={18} />{t('nav.how')}</a>
			<a href={infoUrl('about')}><Icon name="heart" size={18} />{t('nav.about')}</a>
			<a href={infoUrl('contact')}><Icon name="help" size={18} />{t('nav.contact')}</a>
			<div class="menu-sep"></div>
			<button
				class="danger"
				onclick={() => {
					open = false;
					logout();
				}}><Icon name="logout" size={18} />{t('acct.logout')}</button
			>
		{/if}
	</div>
</div>
