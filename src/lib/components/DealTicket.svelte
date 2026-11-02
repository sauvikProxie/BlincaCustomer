<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { L } from '#lib/format.js';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { copyCode } from '#lib/ui.js';
	import { markOpened, flash, offerKey } from '#lib/stores/offers.svelte.js';
	import { setPromoDraft } from '#lib/stores/promo.svelte.js';

	/** @type {{ offer: any, live: boolean, off: boolean, statusText: string, isNew?: boolean }} */
	let { offer, live, off, statusText, isNew = false } = $props();

	let copied = $state(false);
	let timer = 0;
	const flashing = $derived(flash.key === offerKey(offer));

	function copy() {
		if (!offer.code) return;
		copyCode(offer.code, t('offer.copied', { code: offer.code }));
		setPromoDraft(offer.code);
		markOpened(offerKey(offer));
		copied = true;
		clearTimeout(timer);
		timer = window.setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="ticket" class:is-off={off} class:is-new={isNew} class:flash={flashing}>
	{#if isNew}<span class="new-pill"><span class="new-dot"></span>{t('offer.new')}</span>{/if}
	<div class="tim"><Img src={offer.image} /></div>
	<div class="tb">
		<span class="cd" class:deal-urgent={live}><Icon name="clock" size={14} />{statusText}</span>
		<strong>{L(offer.title, lang())}</strong><span class="tt">{L(offer.text, lang())}</span>
		{#if offer.code}
			<button class="code-btn" class:copied onclick={copy} disabled={off} aria-label="{t('rest.copyCode')} {offer.code}"
				><span class="code-txt">{offer.code}</span><span class="code-ic"
					><Icon name={copied ? 'check' : 'copy'} size={16} /></span
				></button
			>
		{/if}
	</div>
</div>

<style>
	.ticket.is-new {
		border-color: var(--pink-border);
		box-shadow: 0 0 0 3px rgba(232, 112, 122, 0.18);
	}
	.new-pill {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 3;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 24px;
		padding: 0 9px;
		border-radius: 999px;
		background: var(--brand);
		color: #fff;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.04em;
	}
	.new-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #fff;
	}
	.ticket.flash {
		animation: offer-flash 1.5s ease;
	}
	@keyframes offer-flash {
		0%,
		100% {
			box-shadow: 0 0 0 3px rgba(232, 112, 122, 0.18);
		}
		25% {
			box-shadow: 0 0 0 6px rgba(232, 112, 122, 0.45);
		}
	}
	/* Phone tickets are narrow: the badge sits on the photo instead of covering the countdown. */
	@media (max-width: 760px) {
		.new-pill {
			left: 8px;
			right: auto;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ticket.flash {
			animation: none;
		}
	}
</style>
