<script>
	import { browser } from '#app/env';
	import { page } from '#app/state';
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { t, lang, setLang } from '#lib/stores/language.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { user, setUser } from '#lib/stores/user.svelte.js';
	import { orders, ordersFeed, reorderOrder, lineLabel } from '#lib/stores/orders.svelte.js';
	import { favorites, toggleFav } from '#lib/stores/favourites.svelte.js';
	import { addressId, allAddresses, setAddress, removeAddress } from '#lib/stores/address.svelte.js';
	import { formatPostcode, hasValidPostcode } from '#lib/postcode.js';
	import { restaurant, item } from '#lib/stores/catalog.svelte.js';
	import { kr, cuisineNames, restaurantUrl, infoUrl, fmtDate, fmtTime } from '#lib/format.js';
	import { openAddressForm, logout, confirm } from '#lib/ui.js';
	import { activeTrackings, track } from '#lib/stores/tracking.svelte.js';
	import { orderRowTag } from '#lib/order/status.js';
	import { isDesignCheck } from '#lib/stores/session.svelte.js';
	import { openReceipt } from '#lib/order/openReceipt.js';
	import { openModal, toast, toastError } from '#lib/layers.svelte.js';
	import EditProfileDialog from '#lib/components/EditProfileDialog.svelte';

	const u = $derived(user());
	const tab = $derived(browser ? page.url.searchParams.get('tab') || 'profile' : 'profile');
	const loc = $derived(lang() === 'sv' ? 'sv-SE' : 'en-GB');

	const initials = $derived.by(() => {
		if (!u) return '?';
		return String(u.name || '?')
			.split(' ')
			.map((x) => x.charAt(0))
			.join('')
			.slice(0, 2)
			.toUpperCase();
	});

	function editProfile() {
		openModal(EditProfileDialog, {}, { label: t('acc.edit') });
	}

	const tabs = $derived([
		['profile', 'user', t('acc.profile')],
		['orders', 'receipt', t('acc.orders')],
		['favourites', 'heart', t('acc.favourites')],
		['addresses', 'pin', t('acc.addresses')]
	]);
	const favs = $derived.by(() => {
		/** @type {any[]} */
		const out = favorites()
			.map((s) => restaurant(s))
			.filter(Boolean);
		return out;
	});
	const recentOrders = $derived(tab === 'orders' ? orders() : orders().slice(0, 3));
	const cur = $derived(addressId());
	const active = $derived(browser ? activeTrackings(orders()) : []);

</script>

<svelte:head>
	<title>{t('acc.title')} – Blinca</title>
</svelte:head>

<div class="wrap info-wrap wide">
	{#if !u}
		<div class="center-card">
			<div class="card auth-card">
				<span class="empty-ic"><Icon name="user" size={26} /></span>
				<h1 class="h2">{t('acc.signedOut')}</h1>
				<p class="muted">{t('acc.signedOutText')}</p>
				<a
					class="btn btn-primary btn-lg btn-block mt-16"
					href="/login?next={encodeURIComponent('/account')}">{t('acct.login')}</a
				>
			</div>
		</div>
	{:else}
		<h1 class="h1">{t('acc.title')}</h1>
		<div class="acc">
			<nav class="card side-nav" aria-label={t('header.account')}>
				{#each tabs as [id, icon, label] (id)}
					<a
						href="/account{['profile'].includes(id) ? '' : `?tab=${id}`}"
						class:is-on={tab === id || (id === 'profile' && !['orders', 'favourites', 'addresses'].includes(tab))}
						aria-current={tab === id ||
						(id === 'profile' && !['orders', 'favourites', 'addresses'].includes(tab))
							? 'page'
							: undefined}><Icon name={icon} size={18} />{label}</a
					>
				{/each}
				<a href={infoUrl('help')}><Icon name="help" size={18} />{t('footer.helpCentre')}</a>
				<div class="pop-wrap">
					<button
						onclick={(e) => {
							const wrap = e.currentTarget.parentNode;
							const m = wrap instanceof HTMLElement ? wrap.querySelector('.menu') : null;
							if (m instanceof HTMLElement) m.hidden = !m.hidden;
						}}
						aria-haspopup="true"
						aria-expanded="false"
						><Icon name="globe" size={18} />{t('header.language')} · {lang().toUpperCase()}</button
					>
					<div class="menu" hidden>
						<button onclick={() => setLang('en')}>English</button>
						<button onclick={() => setLang('sv')}>Svenska</button>
					</div>
				</div>
				<div class="menu-sep"></div>
				<button class="danger" onclick={logout}><Icon name="logout" size={18} />{t('acct.logout')}</button>
			</nav>
			<div class="acc-main">
				{#if tab === 'orders'}
					{#if active.length}
						<section class="track-active-list">
							{#each active as o (o.id)}
								{@const r = restaurant(o.slug)}
								{@const f0 = item(o.slug, o.items[0].itemId)}
								{@const tr = track(o)}
								{@const n = o.items.reduce((/** @type {number} */ s, /** @type {any} */ i) => s + i.qty, 0)}
								<div class="card track-active">
									<span class="ta-th"><Img src={f0 ? f0.image : (r ? r.image : null)} /></span>
									<div class="ta-main">
										<span class="status-pill" class:final={tr.final}>
											{#if !tr.final && !tr.cancelled}<span class="live-dot"></span>{t('track.live')}{' · '}{/if}{t('track.step.' + tr.status)}
										</span>
										<strong class="ta-name">{r?.name ?? ''}</strong>
										<small class="ta-meta">{t('track.orderedAt', { n, total: kr(o.total || o.amount), t: fmtTime(o.date, loc) })}</small>
										<span class="ta-bar" aria-hidden="true">
											{#each tr.steps as _, i (i)}
												<span class="ta-seg" class:done={i < tr.stepIndex} class:cur={i === tr.stepIndex}></span>
											{/each}
										</span>
									</div>
									<a class="btn btn-primary btn-sm ta-btn" href={`/orders/${encodeURIComponent(o.id)}`}>{t('track.trackOrder')}</a>
								</div>
							{/each}
						</section>
					{/if}
					<section class="card pad-card">
						<div class="card-h"><h2 class="h3">{t('acc.orders')}</h2></div>
						<div class="list">
							{#if !orders().length}
								{@render ordersEmpty()}
							{:else}
								{#each orders() as o (o.id)}
									{@const r = restaurant(o.slug)}
									{@const f0 = item(o.slug, o.items[0].itemId)}
									{@const items = o.items
										.map((i) => i.qty + '× ' + lineLabel(o.slug, i, lang()))
										.join(', ')}
									<div class="list-row">
										<span class="th"><Img src={f0 ? f0.image : null} /></span>
										<div class="grow">
											<strong>{r?.name ?? ""}</strong><small
												>{items} · {fmtDate(o.date, loc)} · {kr(o.amount)}{#if o.discount}{' · −'}{kr(o.discount)}{/if}</small
											>
										</div>
										{@render orderTag(o)}
										{#if o.status === 'awaiting_payment'}
											<a
												class="btn btn-primary btn-sm"
												href={`/orders/${encodeURIComponent(o.id)}/pay`}>{m.order_pay_cta()}</a
											>
										{:else}
											<button class="btn btn-secondary btn-sm" onclick={() => reorderOrder(o.id)}
												>{t('home.reorder')}</button
											>
										{/if}
										<button class="btn btn-secondary btn-sm receipt-btn" onclick={() => openReceipt(o.id)}
											>{t('track.receipt')}</button
										>
									</div>
								{/each}
							{/if}
						</div>
					</section>
				{:else if tab === 'favourites'}
					<section class="card pad-card">
						<div class="card-h"><h2 class="h3">{t('acc.favourites')}</h2></div>
						{#if favs.length}
							<div class="list">
								{#each favs as r (r.slug)}
									<div class="list-row">
										<span class="th"><Img src={r.image} /></span>
										<div class="grow">
											<strong>{r?.name ?? ""}</strong><small
												>{cuisineNames(r, lang())} · ★ {r.rating.toFixed(1)}</small
											>
										</div>
										<a class="btn btn-secondary btn-sm" href={restaurantUrl(r.slug)}
											>{t('cart.viewMenu')}</a
										>
										<button
											class="icon-btn sm is-on"
											onclick={() => toggleFav(r.slug)}
											aria-label={t('fav.label', { name: r.name })}><Icon name="heart" size={17} /></button
										>
									</div>
								{/each}
							</div>
						{:else}
							<div class="empty">
								<span class="empty-ic"><Icon name="heart" size={26} /></span>
								<p>{t('acc.noFavorites')}</p>
								<a class="btn btn-primary" href="/#all-restaurants">{t('cart.browse')}</a>
							</div>
						{/if}
					</section>
				{:else if tab === 'addresses'}
					<section class="card pad-card">
						<div class="card-h">
							<h2 class="h3">{t('acc.addresses')}</h2>
							<button class="btn btn-secondary btn-sm" onclick={() => openAddressForm()}
								><Icon name="plus" size={16} />{t('acc.addAddress')}</button
							>
						</div>
						{@render addressList()}
					</section>
				{:else}
					<section class="card pad-card profile">
						<span class="avatar pink"><span>{initials}</span></span>
						<div class="grow">
							<h2 class="h3">{u.name}</h2>
							<p class="muted">{u.email}</p>
							{#if u.phone}<p class="muted">+46 {u.phone}</p>{/if}
						</div>
						<button class="btn btn-secondary btn-sm" onclick={editProfile}
							><Icon name="edit" size={15} />{t('acc.edit')}</button
						>
					</section>
					<section class="card pad-card">
						<div class="card-h">
							<h2 class="h3">{t('acc.recent')}</h2>
							<a class="btn-link sm" href="/account?tab=orders">{t('acc.seeAll')}</a>
						</div>
						<div class="list">
							{#if !recentOrders.length}
								{@render ordersEmpty()}
							{:else}
								{#each recentOrders as o (o.id)}
									{@const r = restaurant(o.slug)}
									{@const f0 = item(o.slug, o.items[0].itemId)}
									{@const items = o.items
										.map((i) => i.qty + '× ' + lineLabel(o.slug, i, lang()))
										.join(', ')}
									<div class="list-row">
										<span class="th"><Img src={f0 ? f0.image : null} /></span>
										<div class="grow">
											<strong>{r?.name ?? ""}</strong><small
												>{items} · {fmtDate(o.date, loc)} · {kr(o.amount)}{#if o.discount}{' · −'}{kr(o.discount)}{/if}</small
											>
										</div>
										{@render orderTag(o)}
										{#if o.status === 'awaiting_payment'}
											<a
												class="btn btn-primary btn-sm"
												href={`/orders/${encodeURIComponent(o.id)}/pay`}>{m.order_pay_cta()}</a
											>
										{:else}
											<button class="btn btn-secondary btn-sm" onclick={() => reorderOrder(o.id)}
												>{t('home.reorder')}</button
											>
										{/if}
										<button class="btn btn-secondary btn-sm receipt-btn" onclick={() => openReceipt(o.id)}
											>{t('track.receipt')}</button
										>
									</div>
								{/each}
							{/if}
						</div>
					</section>
					<section class="card pad-card">
						<div class="card-h">
							<h2 class="h3">{t('acc.addresses')}</h2>
							<button class="btn btn-secondary btn-sm" onclick={() => openAddressForm()}
								><Icon name="plus" size={16} />{t('acc.addAddress')}</button
							>
						</div>
						{@render addressList()}
					</section>
				{/if}
				<button class="btn btn-secondary btn-block m-logout" onclick={logout}
					><Icon name="logout" size={16} />{t('acct.logout')}</button
				>
			</div>
		</div>
	{/if}
</div>

{#snippet addressList()}
	{#if !allAddresses().length}
		<div class="empty">
			<span class="empty-ic"><Icon name="pin" size={26} /></span>
			<p>{m.acc_addresses_empty()}</p>
			<button class="btn btn-primary" onclick={() => openAddressForm()}>{t('acc.addAddress')}</button>
		</div>
	{/if}
	<div class="tile-list">
		{#each allAddresses() as a (a.id)}
			<div class="addr-row">
				<button
					class="radio-tile"
					class:is-on={a.id === cur}
					onclick={() => setAddress(a.id)}
					><span class="rdot"></span><span class="ti"
						><Icon
							name={a.id === 'home' ? 'home' : a.id === 'work' ? 'briefcase' : 'pin'}
							size={18}
						/></span
					><span class="rt-text"
						><strong>{a.label}{a.id === cur ? ' · ' + t('acc.default') : ''}</strong><span
							>{a.street}, {formatPostcode(a.zip)} {a.city}</span
						>{#if !hasValidPostcode(a)}<small class="form-err">{t('addr.zipWarn')}</small>{/if}</span
					></button
				>
				<button
					class="icon-btn sm"
					title={t('addr.edit')}
					aria-label="{t('addr.edit')}: {a.label}"
					onclick={(e) => {
						e.stopPropagation();
						openAddressForm(a);
					}}><Icon name="edit" size={15} /></button
				>
				<button
					class="icon-btn sm"
					title={m.address_delete()}
					aria-label="{m.address_delete()}: {a.label}"
					onclick={(e) => {
						e.stopPropagation();
						confirm({
							title: m.address_delete_title(),
							text: m.address_delete_text({ label: a.label }),
							ok: m.address_delete(),
							onOk: async () => {
								try {
									await removeAddress(a.id);
									toast(m.address_deleted());
								} catch (err) {
									console.warn('[address] delete failed', err);
									toastError(m.address_delete_failed());
								}
							}
						});
					}}><Icon name="trash" size={15} /></button
				>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet ordersEmpty()}
	{#if ordersFeed().error}
		<div class="empty" role="alert">
			<p>{m.error_body()}</p>
			<button type="button" class="btn btn-secondary" onclick={() => location.reload()}>{m.error_retry()}</button>
		</div>
	{:else if ordersFeed().loading}
		<div role="status"><span class="sr-only">{m.loading()}</span><div class="skels sm" aria-hidden="true"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div></div>
	{:else}
		<div class="empty">
			<span class="empty-ic"><Icon name="receipt" size={26} /></span>
			<p>{t('acc.noOrders')}</p>
			<a class="btn btn-primary" href="/#all-restaurants">{t('cart.browse')}</a>
		</div>
	{/if}
{/snippet}

{#snippet orderTag(o)}
	{@const tg = orderRowTag(o, isDesignCheck())}
	<span class="tag" class:good={tg.good}>{#if tg.icon}<Icon name={tg.icon} size={13} />{/if}{tg.label}</span>
{/snippet}
