<script>
	import { goto } from '#app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { L, restaurantUrl } from '#lib/format.js';
	import { restaurant } from '#lib/stores/catalog.svelte.js';
	import { copyCode } from '#lib/ui.js';
	import { markOpened, flashOffer, offerKey } from '#lib/stores/offers.svelte.js';
	import { setPromoDraft } from '#lib/stores/promo.svelte.js';

	/** @type {{ list: any[], close: () => void }} */
	let { list, close } = $props();

	let i = $state(0);
	const offer = $derived(list[i] || list[0]);
	const count = $derived(list.length);

	const rest = $derived(offer.slug ? restaurant(offer.slug) : null);
	const copied = $state({ on: false });
	let copiedTimer = 0;

	/** Ends-in tag only when the offer actually carries an end date. */
	const endsTag = $derived.by(() => {
		const raw = offer.endsAt || offer.end;
		if (!raw) return null;
		const end = Date.parse(raw);
		if (Number.isNaN(end)) return null;
		const days = Math.ceil((end - Date.now()) / 86400000);
		return days <= 0 ? t('offer.endsToday') : t('offer.endsInDays', { n: days });
	});

	function copy() {
		if (!offer.code) return;
		copyCode(offer.code, t('offer.copied', { code: offer.code }));
		setPromoDraft(offer.code);
		markOpened(offerKey(offer));
		copied.on = true;
		clearTimeout(copiedTimer);
		copiedTimer = window.setTimeout(() => (copied.on = false), 2000);
	}

	function order() {
		markOpened(offerKey(offer));
		close();
		goto(offer.slug ? restaurantUrl(offer.slug) : '/#all-restaurants');
	}

	function showAll() {
		flashOffer(offerKey(offer));
		close();
		if (typeof location !== 'undefined' && location.pathname === '/') {
			document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} else {
			goto('/#offers');
		}
	}

	function next() {
		i = (i + 1) % count;
	}
	function prev() {
		i = (i - 1 + count) % count;
	}
	/** @param {number} n */
	function goTo(n) {
		i = ((n % count) + count) % count;
	}

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		if (count < 2) return;
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			next();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prev();
		}
	}

	/* swipe: horizontal → change offer; vertical down → close */
	let sx = 0;
	let sy = 0;
	/** @param {TouchEvent} e */
	function onTouchStart(e) {
		const tt = e.changedTouches[0];
		sx = tt.clientX;
		sy = tt.clientY;
	}
	/** @param {TouchEvent} e */
	function onTouchEnd(e) {
		const tt = e.changedTouches[0];
		const dx = tt.clientX - sx;
		const dy = tt.clientY - sy;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && count > 1) {
			dx < 0 ? next() : prev();
		} else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
			close();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="nof"
	role="group"
	aria-roledescription="offer"
	onkeydown={onKey}
	ontouchstart={onTouchStart}
	ontouchend={onTouchEnd}
>
	<div class="nof-hero">
		<Img src={offer.image} />
		<span class="nof-grad" aria-hidden="true"></span>
		<span class="nof-tagpill"><span class="dot"></span>{t('offer.newOffer')}</span>
		<!-- svelte-ignore a11y_autofocus -->
		<button class="nof-x" data-close autofocus aria-label={t('common.close')}>
			<Icon name="x" size={18} />
		</button>
	</div>

	<div class="nof-body">
		<div class="nof-src"><Icon name="tag" size={15} />{rest ? rest.name : t('offer.allKitchens')}</div>
		<h2 class="nof-title">{L(offer.title, lang())}</h2>
		<p class="nof-desc">{L(offer.text, lang())}</p>

		<div class="nof-meta">
			{#if endsTag}<span class="nof-chip"><Icon name="clock" size={14} />{endsTag}</span>{/if}
			<span class="nof-chip"><Icon name="bike" size={14} />{t('offer.deliveryPickup')}</span>
			{#if offer.rule?.min}<span class="nof-chip">{t('offer.minOrder', { n: offer.rule.min })}</span>{/if}
		</div>

		{#if offer.code}
			<div class="nof-code">
				<span class="nof-code-txt">{offer.code}</span>
				<button class="nof-copy" class:copied={copied.on} onclick={copy}>
					<Icon name={copied.on ? 'check' : 'copy'} size={16} />{t('offer.copyShort')}
				</button>
			</div>
		{/if}

		<div class="nof-actions">
			<button class="btn btn-secondary nof-btn secondary-only" onclick={showAll}>{t('offer.seeAll')}</button>
			<button class="btn btn-primary nof-btn" onclick={order}>
				{rest ? t('offer.orderFrom', { name: rest.name }) : t('offer.startOrdering')}
			</button>
		</div>

		{#if count > 1}
			<div class="nof-foot">
				<span class="nof-count">
					{t('offer.counter', { x: i + 1, y: count })}<span class="swipe-hint">&nbsp;· {t('offer.swipeNext')}</span>
				</span>
				<span class="nof-dots" aria-hidden="true">
					{#each list as _, d (d)}
						<button class="nof-dot" class:on={d === i} onclick={() => goTo(d)} tabindex="-1" aria-label={String(d + 1)}></button>
					{/each}
				</span>
				<button class="nof-next" onclick={next}>{t('offer.next')} <Icon name="arrow" size={15} /></button>
			</div>
		{/if}
	</div>
</div>

<style>
	.nof {
		display: flex;
		flex-direction: column;
	}
	.nof-hero {
		position: relative;
		height: 210px;
		overflow: hidden;
		background: var(--soft);
		border-radius: 26px 26px 0 0;
	}
	.nof-hero :global(img),
	.nof-hero :global(.ph) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.nof-grad {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent 55%, rgba(30, 14, 14, 0.5));
		pointer-events: none;
	}
	.nof-tagpill {
		position: absolute;
		top: 14px;
		left: 14px;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 28px;
		padding: 0 12px;
		border-radius: 999px;
		background: var(--brand);
		color: #fff;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
	}
	.nof-tagpill .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #fff;
	}
	.nof-x {
		position: absolute;
		top: 14px;
		right: 14px;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: #fff;
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
	.nof-x:hover {
		background: var(--soft);
	}

	.nof-body {
		padding: 18px 22px 22px;
		display: flex;
		flex-direction: column;
	}
	.nof-src {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 700;
		color: var(--brand-dark);
	}
	.nof-title {
		margin: 8px 0 0;
		font-size: 28px;
		font-weight: 600;
		line-height: 1.15;
		color: var(--text);
	}
	.nof-desc {
		margin: 8px 0 0;
		font-size: 15px;
		color: var(--muted);
	}
	.nof-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 14px;
	}
	.nof-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 30px;
		padding: 0 12px;
		border-radius: 999px;
		background: var(--soft);
		color: var(--text-2);
		font-size: 13px;
		font-weight: 600;
	}
	.nof-chip :global(.ic) {
		color: var(--brand);
	}

	.nof-code {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		height: 50px;
		margin-top: 16px;
		padding: 0 6px 0 16px;
		border: 1.5px dashed var(--pink-border);
		border-radius: 12px;
		background: #fffdf5;
	}
	.nof-code-txt {
		font-size: 16px;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--text);
	}
	.nof-copy {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		padding: 0 14px;
		border-radius: 9px;
		background: #fff;
		border: 1px solid var(--border);
		font-size: 13.5px;
		font-weight: 700;
		color: var(--text);
	}
	.nof-copy:hover {
		border-color: var(--border-strong);
	}
	.nof-copy.copied {
		color: var(--green);
		border-color: var(--green);
	}

	.nof-actions {
		display: flex;
		gap: 10px;
		margin-top: 18px;
	}
	.nof-btn {
		flex: 1;
		height: 52px;
		font-size: 15px;
	}

	.nof-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-top: 16px;
		padding-top: 14px;
		border-top: 1px solid var(--border);
	}
	.nof-count {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--muted);
	}
	.swipe-hint {
		display: none;
	}
	.nof-dots {
		display: flex;
		gap: 6px;
	}
	.nof-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--border-strong);
	}
	.nof-dot.on {
		background: var(--brand);
		transform: scale(1.15);
	}
	.nof-next {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 14px;
		font-weight: 700;
		color: var(--brand-dark);
	}
	.nof-next:hover {
		color: var(--brand-hover);
	}

	/* Phone bottom-sheet variant (the global CSS already turns .modal into a sheet ≤760px). */
	@media (max-width: 760px) {
		.nof-hero {
			height: 170px;
			border-radius: 20px 20px 0 0;
		}
		.nof-hero::before {
			content: '';
			position: absolute;
			top: 8px;
			left: 50%;
			transform: translateX(-50%);
			width: 40px;
			height: 4px;
			border-radius: 2px;
			background: rgba(255, 255, 255, 0.85);
			z-index: 2;
		}
		.nof-code {
			height: 46px;
		}
		/* phone: single primary button + "swipe for next" hint, hide dots/next */
		.secondary-only {
			display: none;
		}
		.swipe-hint {
			display: inline;
		}
		.nof-dots,
		.nof-next {
			display: none;
		}
		.nof-foot {
			justify-content: center;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.nof-dot.on {
			transform: none;
		}
	}
</style>
