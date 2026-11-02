<script>
	import { browser } from '#app/env';
	import { page } from '#app/state';
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { isCheckoutPath, isTrackPath } from '#lib/routes.js';
	import { orders } from '#lib/stores/orders.svelte.js';
	import { activeTrackings, track, subscribeClock } from '#lib/stores/tracking.svelte.js';

	const hidden = $derived(isTrackPath(page.url.pathname) || isCheckoutPath(page.url.pathname));
	const active = $derived.by(() => {
		if (!browser) return null;
		const a = activeTrackings(orders());
		return a.length ? a[0] : null;
	});
	// The 1s clock only matters while something is on its way; stops on unmount
	// or once the order goes final.
	$effect(() => {
		if (!active) return;
		return subscribeClock();
	});
	const tr = $derived(active ? track(active) : null);
	const progress = $derived(tr ? (tr.stepIndex + 1) / tr.steps.length : 0);
	const statusText = $derived(
		tr ? t('track.step.' + tr.status) + (tr.minutesLeft > 0 && !tr.final ? ' · ' + t('track.minutes', { n: tr.minutesLeft }) : '') : ''
	);
	const show = $derived(!hidden && !!tr && !tr.cancelled);
	// Page-level rules (app.css) reserve room under the content and lift the cart bar/toast
	// above the pill, so it never covers anything.
	$effect(() => {
		if (!show) return;
		document.body.classList.add('has-pill');
		return () => document.body.classList.remove('has-pill');
	});
</script>

{#if show && tr && active}
	<div class="pill" role="status">
		<span class="pill-ic"><Icon name="bike" size={18} /></span>
		<div class="pill-body">
			<span class="pill-text">{statusText}</span>
			<span class="pill-bar"><span class="pill-fill" style="width: {Math.round(progress * 100)}%"></span></span>
		</div>
		<a class="pill-btn" href={`/orders/${encodeURIComponent(active.id)}`}>{t('track.track')}</a>
	</div>
{/if}

<style>
	.pill {
		position: fixed;
		left: 20px;
		bottom: calc(20px + env(safe-area-inset-bottom));
		z-index: 56;
		display: flex;
		align-items: center;
		gap: 12px;
		width: 320px;
		max-width: calc(100vw - 40px);
		padding: 10px 10px 10px 12px;
		background: var(--dark);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 18px;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
	}
	.pill-ic {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--brand);
		color: #fff;
		flex: none;
	}
	.pill-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.pill-text {
		font-size: 13.5px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.pill-bar {
		height: 4px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.22);
		overflow: hidden;
	}
	.pill-fill {
		display: block;
		height: 100%;
		background: var(--brand);
		transition: width 0.5s ease;
	}
	.pill-btn {
		flex: none;
		padding: 8px 16px;
		border-radius: 12px;
		background: #fff;
		color: var(--text);
		font-size: 13.5px;
		font-weight: 700;
	}
	.pill-btn:hover {
		background: var(--soft);
	}

	/* phone: full-width, above the cart bar + tab bar */
	@media (max-width: 760px) {
		.pill {
			left: 12px;
			right: 12px;
			width: auto;
			bottom: calc(82px + env(safe-area-inset-bottom));
		}
		:global(body:has(.cart-bar)) .pill {
			bottom: calc(142px + env(safe-area-inset-bottom));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pill-fill {
			transition: none;
		}
	}
</style>
