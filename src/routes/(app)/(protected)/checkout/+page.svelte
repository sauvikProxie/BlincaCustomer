<script>
	import { browser } from '#app/env';
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import Stepper from '#lib/components/Stepper.svelte';
	import PromoBox from '#lib/components/PromoBox.svelte';
	import Totals from '#lib/components/Totals.svelte';
	import { useMutation } from 'convex-svelte';
	import { checkoutApi } from '#lib/services/catalog.js';
	import { fingerprint } from '#lib/cart/fingerprint.js';
	import { splitOpts } from '#lib/variants.js';
	import { t, lang } from '#lib/stores/language.svelte.js';
import { m } from '#lib/paraglide/messages.js';
	import {
		cart,
		cartRestaurant,
		subtotal,
		lineTotal,
		changeQty,
		removeLineById,
		staleLines,
		clearCart,
		pricing,
		deliveryMode,
		setDeliveryMode,
		promoCode
	} from '#lib/stores/cart.svelte.js';
	import { promoIssueMessage } from '#lib/stores/promo.svelte.js';
	import { item } from '#lib/stores/catalog.svelte.js';
	import { address, addressId, allAddresses, setAddress } from '#lib/stores/address.svelte.js';
	import { formatPostcode, hasValidPostcode, postcodeDigits } from '#lib/postcode.js';
	import { user } from '#lib/stores/user.svelte.js';
	import { addOrder } from '#lib/stores/orders.svelte.js';
	import { startTracking } from '#lib/stores/tracking.svelte.js';
	import { isDesignCheck } from '#lib/stores/session.svelte.js';
	import { goto } from '#app/navigation';
	import { L, kr, prKr, deliverable, restaurantUrl, dayRanges, fmtDate, fmtTime } from '#lib/format.js';
	import { issueText, slotOptions } from '#lib/checkout/issues.js';
	import { openAddressForm } from '#lib/ui.js';
	import { toastError } from '#lib/layers.svelte.js';

	const placeOrderMut = browser && !isDesignCheck() ? useMutation(checkoutApi.placeOrder) : null;

	const u = $derived(user());
	let time = $state('asap');
	let slot = $state('');
	let cc = $state('+46');
	// Real mode always starts empty (no profile prefill); design-check keeps
	// the verbatim seeded behaviour so pixel parity is untouched.
	// svelte-ignore state_referenced_locally
	let phone = $state(!isDesignCheck() ? '' : (u?.phone || ''));
	let note = $state('');
	let placing = $state(false);
	let done = $state(false);

	const r = $derived(cartRestaurant());
	// A chosen slot (ms in real mode, ISO text in design-check) goes to the preview so
	// the backend checks that exact time.
	const slotMs = $derived(
		!slot ? undefined : /^\d+$/.test(slot) ? Number(slot) : Date.parse(slot)
	);
	const pr = $derived(pricing(undefined, time === 'schedule' && slotMs ? slotMs : undefined));
	const addr = $derived(address());
	const stale = $derived(staleLines());
	// Zone/restaurant minimum from the preview when there is one, else the
	// restaurant's fallback (the cheapest zone's).
	const minOrder = $derived(pr.min ?? r?.minOrder ?? 0);

	function eta() {
		if (!r) return 0;
		return deliveryMode() === 'pickup' ? r.pickupEta : r.eta + (addr.extraEta || 10);
	}

	function slots() {
		/** @type {Array<{ v: string, l: string }>} */
		const out = [];
		if (!r) return out;
		const now = new Date();
		for (let day = 0; day < 2 && out.length < 24; day++) {
			const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
			// Closed weekdays (null) and closed special days have no ranges, so
			// they contribute no slots instead of reading as open 24/7.
			for (const [open, close] of dayRanges(r, d)) {
				const o = open.split(':'),
					c = close.split(':');
				const start = new Date(d);
				start.setHours(+o[0], +o[1], 0, 0);
				const end = new Date(d);
				end.setHours(+c[0], +c[1], 0, 0);
				if (end <= start) end.setDate(end.getDate() + 1);
				let s = new Date(Math.max(start.getTime() + 30 * 60000, now.getTime() + 45 * 60000));
				s.setMinutes(s.getMinutes() < 30 ? 30 : 60, 0, 0);
				for (; s <= end && out.length < 24; s = new Date(s.getTime() + 30 * 60000)) {
					const lbl =
						(s.toDateString() === now.toDateString() ? t('co.today') : t('co.tomorrow')) +
						' ' +
						('0' + s.getHours()).slice(-2) +
						':' +
						('0' + s.getMinutes()).slice(-2);
					out.push({ v: s.toISOString(), l: lbl });
				}
			}
		}
		return out;
	}

	// A signed-in customer with nothing saved yet: `address()` is only a header placeholder.
	const noAddress = $derived(!isDesignCheck() && deliveryMode() === 'delivery' && !allAddresses().length);
	const digits = $derived(phone.replace(/\D/g, '').length);
	const problems = $derived.by(() => {
		if (!r) return [];
		const p = [];
		if (stale.length) p.push(m.cart_issue_removed());
		if (noAddress) p.push(m.co_add_address());
		if (isDesignCheck()) {
			if (deliveryMode() === 'delivery' && !deliverable(addr)) p.push(t('co.noDeliver'));
		} else {
			// Real mode: the backend decides (closed, paused, zone, slot, stock); show its issues.
			for (const i of pr.view?.issues ?? []) {
				if (i.code === 'BELOW_MINIMUM_ORDER' || i.code === 'PROMO_INVALID') continue; // shown below / by the promo box
				const text = issueText(i.code, { name: r.name });
				if (text && !p.includes(text)) p.push(text);
			}
		}
		if (deliveryMode() === 'delivery' && addr?.id && !hasValidPostcode(addr)) p.push(t('addr.zipBadSaved'));
		if (!pr.loading && !pr.stale && minOrder && pr.sub < minOrder) p.push(t('rest.minLeft', { n: minOrder - pr.sub }));
		if (time === 'schedule' && !slot) p.push(t('co.hintSlot'));
		if (digits < 7 || digits > 15) p.push(digits ? m.co_phone_invalid() : t('co.hintPhone'));
		if (isDesignCheck() && r.status !== 'open') p.push(t('rest.notTaking', { name: r.name }));
		return p;
	});
	const deliveryOk = $derived(deliveryMode() === 'pickup' || (!noAddress && deliverable(addr)));
	// Keep the last slots while a re-priced preview is loading, so the select does not blink empty.
	let slotCache = $state(/** @type {number[]} */ ([]));
	$effect(() => {
		const s = pr.view?.slots;
		if (s?.length) slotCache = s;
	});
	const slotList = $derived(
		time !== 'schedule' || !r
			? []
			: isDesignCheck()
				? slots()
				: slotOptions(pr.view?.slots ?? slotCache, lang(), Date.now(), fmtDate, fmtTime)
	);

	$effect(() => {
		if (time === 'schedule' && r && !slot && slotList.length) slot = slotList[0].v;
	});

	/** @param {string} v */
	function setTime(v) {
		time = v;
		if (v === 'asap') slot = '';
	}

	async function place() {
		if (!r || problems.length || placing || pr.loading || pr.stale || !browser) return;
		// Design-check: fake local order verbatim (pixel-identical, no backend).
		if (isDesignCheck()) {
			placing = true;
			setTimeout(() => {
				const order = {
					id: 'BL-' + (10500 + Math.floor(Math.random() * 89000)),
					slug: r.slug,
					date: new Date().toISOString().slice(0, 19),
					amount: pr.sub,
					total: pr.total,
					mode: deliveryMode(),
					items: cart().map((l) => ({ itemId: l.itemId, opts: l.opts, qty: l.qty }))
				};
				placing = false;
				done = true;
				addOrder(order);
				startTracking(order);
				clearCart();
				/* Go straight to live tracking (same id the order was saved with). */
				goto('/orders/' + encodeURIComponent(order.id));
			}, 900);
			return;
		}
		// Real mode: checkout.preview totals already shown via cart mirror;
		// place via checkout.placeOrder then hand to Mollie (/orders/{id}/pay).
		if (!placeOrderMut) return;
		placing = true;
		try {
			const fulfillment = deliveryMode();
			const addr = address();
			let addressArg = undefined;
			let addressIdArg = undefined;
			if (fulfillment === 'delivery' && addr) {
				if (addr._id) addressIdArg = addr._id;
				else if (addr.street && addr.zip && addr.city) {
					addressArg = { street: addr.street, postalCode: /** @type {string} */ (postcodeDigits(addr.zip)), city: addr.city };
				}
			}
			const fullPhone = ((cc || '') + (phone || '')).trim();
			const scheduled = time === 'schedule' ? slotMs : undefined;
			const lines = cart().map((l) => {
				const { variantId, optionIds } = splitOpts(l.opts);
				return { menuItemId: String(l.itemId), variantId: variantId ?? null, optionIds, quantity: l.qty, note: l.note || null };
			});
			const code = !isDesignCheck() ? promoCode() : null;
			const fp = fingerprint({
				lines,
				fulfillment,
				address:
					addressIdArg != null
						? { kind: 'id', id: String(addressIdArg) }
						: addressArg
							? { kind: 'fields', street: addressArg.street, postalCode: addressArg.postalCode, city: addressArg.city }
							: null,
				...(scheduled != null && Number.isFinite(scheduled) ? { scheduledFor: scheduled } : {}),
				...(code ? { promoCode: code } : {})
			});
			const res = await placeOrderMut({
				fulfillment,
				...(addressIdArg != null ? { addressId: addressIdArg } : {}),
				...(addressIdArg == null && addressArg ? { address: addressArg } : {}),
				phone: fullPhone,
				...(note.trim() ? { note: note.trim() } : {}),
				...(scheduled != null && Number.isFinite(scheduled) ? { scheduledFor: scheduled } : {}),
				...(code ? { promoCode: code } : {}),
				fingerprint: fp
			});
			done = true;
			await goto('/orders/' + encodeURIComponent(String(res.orderId)) + '/pay');
		} catch (e) {
			const data = /** @type {{ data?: { code?: string; reason?: string; shortfallCents?: number } }|null} */ (
				e && typeof e === 'object' ? e : null
			)?.data;
			const code = !isDesignCheck() && data ? data.code : null;
			if (code === 'PROMO_INVALID') {
				toastError(
					promoIssueMessage({
						code: 'PROMO_INVALID',
						promoReason: data?.reason,
						// placeOrder reports `shortfallCents`; the message helper
						// (like preview issues) reads `promoShortfallCents`.
						...(data?.shortfallCents !== undefined ? { promoShortfallCents: data.shortfallCents } : {})
					})
				);
			} else if (code === 'ORDER_LIMIT') {
				toastError(m.co_order_limit());
			} else if (code && issueText(code, { name: r?.name, shortfallCents: data?.shortfallCents })) {
				toastError(/** @type {string} */ (issueText(code, { name: r?.name, shortfallCents: data?.shortfallCents })));
			} else if (code === 'VALIDATION') {
				toastError(m.co_fix_errors());
			} else {
				console.warn('[checkout] placeOrder failed', e);
				toastError(m.co_place_failed());
			}
		} finally {
			placing = false;
		}
	}

	let phoneBad = $state(false);
</script>

<svelte:head>
	<title>{t('title.checkout')}</title>
</svelte:head>

{#if !r}
	{#if !done}
		<div class="wrap narrow pad-y">
			<h1 class="h1">{t('co.title')}</h1>
			<div class="empty mt-16">
				<span class="empty-ic"><Icon name="cart" size={28} /></span>
				<h2>{t('cart.empty')}</h2>
				<p>{t('cart.emptyText')}</p>
				<a class="btn btn-primary" href="/#all-restaurants">{t('cart.browse')}</a>
			</div>
		</div>
	{/if}
{:else}
	<div class="wrap co-wrap">
		<a class="back-link" href={restaurantUrl(r.slug)}
			><Icon name="left" size={16} />{t('co.backTo', { name: r.name })}</a
		>
		<h1 class="h1">{t('co.title')}</h1>
		<div class="co">
			<div class="co-steps">
				<section class="card step">
					<div class="step-h">
						<span class="num done"><Icon name="check" size={15} /></span><h2 class="h3">{t('co.how')}</h2>
					</div>
					<div class="seg lg" role="radiogroup">
						<button
							role="radio"
							aria-checked={deliveryMode() === 'delivery'}
							class:is-on={deliveryMode() === 'delivery'}
							onclick={() => setDeliveryMode('delivery')}
							><Icon name="bike" size={18} />{t('co.delivery')} · {t('common.minRange', {
								a: r.eta,
								b: r.eta + 10
							})}</button
						>
						<button
							role="radio"
							aria-checked={deliveryMode() === 'pickup'}
							class:is-on={deliveryMode() === 'pickup'}
							onclick={() => setDeliveryMode('pickup')}
							><Icon name="walk" size={18} />{t('co.pickup')} · {t('common.min', {
								n: r.pickupEta
							})}</button
						>
					</div>
				</section>

				<section class="card step">
					<div class="step-h">
						{#if deliveryOk}
							<span class="num done"><Icon name="check" size={15} /></span>
						{:else}
							<span class="num">2</span>
						{/if}<h2 class="h3"
							>{deliveryMode() === 'pickup' ? t('co.pickupFrom') : t('co.deliveryAddress')}</h2
						>
					</div>
					{#if deliveryMode() === 'pickup'}
						<div class="radio-tile is-on static">
							<span class="ti"><Icon name="walk" size={18} /></span><span class="rt-text"
								><strong>{r.name}</strong><span>{r.address}</span></span
							>
						</div>
						<p class="ok-msg"><Icon name="check" size={16} />{t('co.readyIn', { eta: r.pickupEta })}</p>
					{:else}
						<div class="tile-list" role="radiogroup">
							{#each allAddresses() as a (a.id)}
								{@const ok = deliverable(a)}
								<label class="radio-tile" class:is-on={a.id === addressId()}>
									<input
										type="radio"
										name="addr"
										value={a.id}
										checked={a.id === addressId()}
										onchange={() => setAddress(a.id)}
									/><span class="rdot"></span><span class="ti"
										><Icon
											name={a.id === 'home' ? 'home' : a.id === 'work' ? 'briefcase' : 'pin'}
											size={18}
										/></span
									>
									<span class="rt-text"
										><strong>{a.label}</strong><span
											>{a.street}, {formatPostcode(a.zip)} {a.city}{#if !ok}{' · '}{t('addr.outside')}{/if}</span
										>{#if !hasValidPostcode(a)}<span class="form-err"><Icon name="info" size={14} />{t('addr.zipBadSaved')}</span>{/if}</span
									></label
								>
							{/each}
						</div>
						<button class="btn btn-secondary btn-sm dashed mt-12" onclick={() => openAddressForm()}
							><Icon name="plus" size={16} />{t('addr.addNew')}</button
						>
						{#if noAddress}
							<p class="form-err"><Icon name="info" size={16} />{m.co_add_address()}</p>
						{:else if deliverable(addr)}
							<p class="ok-msg">
								<Icon name="check" size={16} />{t('co.weDeliver', { fee: kr(r.fee), eta: eta() })}
							</p>
						{:else}
							<p class="form-err"><Icon name="info" size={16} />{t('co.noDeliver')}</p>
						{/if}
					{/if}
				</section>

				<section class="card step">
					<div class="step-h">
						<span class="num done"><Icon name="check" size={15} /></span><h2 class="h3"
							>{deliveryMode() === 'pickup' ? t('co.pickupTime') : t('co.deliveryTime')}</h2
						>
					</div>
					<div class="seg lg" role="radiogroup">
						<button
							role="radio"
							aria-checked={time === 'asap'}
							class:is-on={time === 'asap'}
							onclick={() => setTime('asap')}>{t('co.asap')} · {t('common.min', { n: eta() })}</button
						>
						<button
							role="radio"
							aria-checked={time === 'schedule'}
							class:is-on={time === 'schedule'}
							onclick={() => setTime('schedule')}><Icon name="clock" size={17} />{t('co.schedule')}</button
						>
					</div>
					{#if time === 'schedule'}
						<div class="select-wrap mt-12">
							<select
								class="field"
								aria-label={t('co.schedule')}
								value={slot}
								onchange={(e) => (slot = e.currentTarget.value)}
							>
								{#each slotList as s (s.v)}<option value={s.v} selected={s.v === slot}>{s.l}</option>{/each}
							</select><Icon name="down" size={17} />
						</div>
						{#if !slotList.length && !pr.loading && !isDesignCheck()}<p class="hint">{m.co_no_slots()}</p>{/if}
					{/if}
				</section>

				<section class="card step">
					<div class="step-h">
						{#if digits >= 7 && digits <= 15}
							<span class="num done"><Icon name="check" size={15} /></span>
						{:else}
							<span class="num">4</span>
						{/if}<h2 class="h3">{t('co.contact')}</h2>
					</div>
					<label class="label" for="co-phone">{t('co.phone')}</label>
					<div class="phone-row">
						<div class="select-wrap">
							<select
								class="field"
								aria-label={t('co.country')}
								value={cc}
								onchange={(e) => (cc = e.currentTarget.value)}
							>
								{#each [['+46', '🇸🇪 +46'], ['+47', '🇳🇴 +47'], ['+45', '🇩🇰 +45'], ['+358', '🇫🇮 +358']] as c}
									<option value={c[0]} selected={c[0] === cc}>{c[1]}</option>
								{/each}
							</select><Icon name="down" size={16} />
						</div>
						<input
							class="field"
							class:is-invalid={phoneBad}
							aria-invalid={phoneBad || undefined}
							aria-describedby={phoneBad ? 'co-phone-err co-phone-help' : 'co-phone-help'}
							id="co-phone"
							type="tel"
							inputmode="tel"
							autocomplete="tel-national"
							placeholder="70 123 45 67"
							value={phone}
							oninput={(e) => {
								phone = e.currentTarget.value;
								phoneBad = false;
							}}
							onfocusout={() => (phoneBad = !!phone && (digits < 7 || digits > 15))}
						/>
					</div>
					{#if phoneBad}<p class="form-err" id="co-phone-err" role="alert">
							<Icon name="info" size={15} />{m.co_phone_invalid()}
						</p>{/if}
					<p class="help" id="co-phone-help">{t('co.phoneHelp')}</p>
				</section>

				<section class="card step">
					<div class="step-h">
						{#if note.trim()}
							<span class="num done"><Icon name="check" size={15} /></span>
						{:else}
							<span class="num">5</span>
						{/if}<h2 class="h3">
							{t('co.note')} <span class="count">{t('common.optional')}</span>
						</h2>
					</div>
					<textarea
						class="field field-area"
						id="co-note"
						rows="3"
						maxlength="300"
						placeholder={t('co.notePh')}
						value={note}
						oninput={(e) => (note = e.currentTarget.value)}
					></textarea>
				</section>
			</div>

			<aside class="card co-summary">
				<div class="sc-head">
					<h2 class="h3">{t('co.yourOrder')}</h2>
					<button
						class="btn-link sm"
						onclick={() => {
							window.location.href = restaurantUrl(r.slug);
						}}>{t('co.editCart')}</button
					>
				</div>
				<div class="row-card plain">
					<span class="th"><Img src={r.image} /></span><span class="grow"
						><strong>{r.name}</strong><small>{r.address.split(',').slice(0, 2).join(',')}</small></span
					>
				</div>
				{#each cart() as l (l.key)}
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
					<div class="sum-line">
						<span class="th sm"><Img src={it.image} /></span>
						<div class="grow">
							<strong>{L(it.name, lang())}</strong><small
								>{#if sub}{sub}{' · '}{/if}{kr(lineTotal(l))}</small
							>
						</div>
						<Stepper
							qty={l.qty}
							decLabel={t('qty.less', { name: L(it.name, lang()) })}
							incLabel={t('qty.more', { name: L(it.name, lang()) })}
							onDec={() => changeQty(l.key, -1)}
							onInc={() => changeQty(l.key, 1)}
						/>
					</div>
				{/each}
				{#each stale as s (s.lineId)}
					<div class="sum-line">
						<span class="th sm"></span>
						<div class="grow"><strong>{m.cart_issue_removed()}</strong></div>
						<button
							class="icon-btn xs"
							onclick={() => removeLineById(s.lineId)}
							aria-label={t('cart.remove')}><Icon name="trash" size={15} /></button
						>
					</div>
				{/each}
				<div class="mt-12"><PromoBox /></div>
				<div class="sc-totals"><Totals pr={pr} /></div>
				<button class="btn btn-primary btn-lg btn-block mt-12" disabled={problems.length > 0 || placing || pr.loading || pr.stale} onclick={place}>
					{placing ? t('co.processing') : t('co.placeTotal', { total: prKr(pr, pr.total) })}
				</button>
				{#if problems.length && !placing}<p class="hint">{problems[0]}</p>{/if}
				<p class="secure"><Icon name="shield" size={15} />{t('co.secure')}</p>
			</aside>
		</div>
	</div>
	<div class="co-bar">
		{#if problems.length && !placing}<p class="co-bar-hint">{problems[0]}</p>{/if}
		<div><small>{t('co.total')}</small><strong class:pr-stale={pr.stale}>{prKr(pr, pr.total)}</strong></div>
		<button class="btn btn-primary btn-lg grow" disabled={problems.length > 0 || placing || pr.loading || pr.stale} onclick={place}>
			{placing ? t('co.processing') : t('co.place')}
		</button>
	</div>
{/if}
