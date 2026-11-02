<script>
	import { tick } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { user } from '#lib/stores/user.svelte.js';
	import { logout } from '#lib/ui.js';
	import { infoUrl } from '#lib/format.js';

	let open = $state(false);
	/** @type {HTMLElement|null} */
	let wrap = $state(null);
	/** @type {HTMLButtonElement|null} */
	let btn = $state(null);

	const u = $derived(user());
	const initials = $derived.by(() => {
		const name = (u?.name || '').trim();
		if (!name) return '';
		const parts = name.split(/\s+/);
		return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase();
	});

	function close(focusBtn = false) {
		open = false;
		if (focusBtn) btn?.focus();
	}

	/** @param {KeyboardEvent} e */
	async function onKey(e) {
		if (e.key === 'Escape' && open) {
			e.preventDefault();
			close(true);
			return;
		}
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		if (!open) {
			open = true;
			await tick();
		}
		const items = /** @type {HTMLElement[]} */ ([...(wrap?.querySelectorAll('[role="menuitem"]') ?? [])]);
		if (!items.length) return;
		const i = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
		const step = e.key === 'ArrowDown' ? 1 : -1;
		items[i === -1 ? (step === 1 ? 0 : items.length - 1) : (i + step + items.length) % items.length].focus();
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

<!-- svelte-ignore a11y_no_static_element_interactions (Escape and arrows bubble from the trigger and the menu items) -->
<div class="am" bind:this={wrap} onkeydown={onKey}>
	<button
		bind:this={btn}
		class="am-btn"
		class:guest={!u}
		onclick={() => (open = !open)}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={u && initials ? `${initials} ${t('header.account')}` : t('header.account')}
	>
		{#if u && initials}<span class="initials">{initials}</span>{:else}<Icon name="user" size={20} />{/if}
	</button>

	{#if open}
		<div class="am-menu" role="menu" aria-label={t('header.account')}>
			{#if u}
				<div class="am-user">
					<strong>{u.name}</strong>
					<span>{u.email}</span>
				</div>
				<a role="menuitem" href="/account" onclick={() => close()}><Icon name="user" size={18} />{t('acc.profile')}</a>
				<a role="menuitem" href="/account?tab=orders" onclick={() => close()}><Icon name="receipt" size={18} />{t('acc.orders')}</a>
				<a role="menuitem" href="/account?tab=favourites" onclick={() => close()}><Icon name="heart" size={18} />{t('acc.favourites')}</a>
				<a role="menuitem" href="/account?tab=addresses" onclick={() => close()}><Icon name="pin" size={18} />{t('acc.addresses')}</a>
				<div class="am-sep"></div>
				<button
					role="menuitem"
					class="danger"
					onclick={() => {
						close();
						logout();
					}}><Icon name="logout" size={18} />{t('acct.logout')}</button
				>
			{:else}
				<a role="menuitem" href="/login" onclick={() => close()}><Icon name="user" size={18} />{t('acct.login')}</a>
				<div class="am-sep"></div>
				<a role="menuitem" href={infoUrl('how')} onclick={() => close()}><Icon name="info" size={18} />{t('nav.how')}</a>
				<a role="menuitem" href={infoUrl('about')} onclick={() => close()}><Icon name="heart" size={18} />{t('nav.about')}</a>
				<a role="menuitem" href={infoUrl('contact')} onclick={() => close()}><Icon name="help" size={18} />{t('nav.contact')}</a>
			{/if}
		</div>
	{/if}
</div>

<style>
	.am {
		position: relative;
		flex: none;
	}
	.am-btn {
		width: 44px;
		height: 44px;
		border-radius: 14px;
		display: grid;
		place-items: center;
		background: var(--pink);
		color: var(--brand-dark);
		transition: filter 0.15s;
	}
	.am-btn:hover {
		filter: brightness(0.97);
	}
	.am-btn.guest {
		background: var(--soft);
		color: var(--text);
	}
	.initials {
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.3px;
	}
	.am-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 10px);
		z-index: 80;
		width: 230px;
		padding: 8px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: 0 16px 40px rgba(60, 20, 20, 0.16);
		display: flex;
		flex-direction: column;
	}
	.am-user {
		padding: 8px 12px 10px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 4px;
		display: flex;
		flex-direction: column;
	}
	.am-user strong {
		font-weight: 600;
	}
	.am-user span {
		font-size: 13px;
		color: var(--muted);
	}
	.am-menu a,
	.am-menu button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: 14.5px;
		color: var(--text);
		text-align: left;
	}
	.am-menu a:hover,
	.am-menu button:hover {
		background: var(--bg);
	}
	.am-menu .danger {
		color: var(--brand-dark);
	}
	.am-sep {
		height: 1px;
		background: var(--border);
		margin: 4px 2px;
		flex: none;
	}
</style>
