<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';

	/** @type {{ value: number, max: number, done?: boolean }} */
	let { value, max, done = false } = $props();

	const R = 54;
	const C = 2 * Math.PI * R;
	const progress = $derived(done ? 1 : max > 0 ? Math.min(1, Math.max(0, (max - value) / max)) : 0);
	const offset = $derived(C * (1 - progress));
</script>

<div class="ring" role="img" aria-label={done ? t('track.step.delivered') : t('track.minutes', { n: value })}>
	<svg viewBox="0 0 128 128" width="128" height="128">
		<circle cx="64" cy="64" r={R} fill="none" stroke="var(--pink)" stroke-width="10" />
		<circle
			cx="64"
			cy="64"
			r={R}
			fill="none"
			stroke="var(--brand)"
			stroke-width="10"
			stroke-linecap="round"
			stroke-dasharray={C}
			stroke-dashoffset={offset}
			transform="rotate(-90 64 64)"
		/>
	</svg>
	<div class="ring-mid">
		{#if done}
			<Icon name="check" size={30} cls="ring-check" />
		{:else}
			<strong>{value}</strong><small>min</small>
		{/if}
	</div>
</div>

<style>
	.ring {
		position: relative;
		width: 128px;
		height: 128px;
		flex: none;
		align-self: center;
	}
	.ring svg circle {
		transition: stroke-dashoffset 0.5s ease;
	}
	.ring-mid {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		line-height: 1;
		text-align: center;
	}
	.ring-mid strong {
		font-size: 34px;
		font-weight: 800;
		letter-spacing: -0.01em;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.ring-mid small {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
		margin-top: 3px;
	}
	.ring-mid :global(.ring-check) {
		color: var(--green);
	}
	@media (prefers-reduced-motion: reduce) {
		.ring svg circle {
			transition: none;
		}
	}
</style>
