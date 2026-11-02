<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { clock } from '#lib/stores/tracking.svelte.js';

	/**
	 * The rider carrying the order (customer.orderTracking.rider): who they are,
	 * what they are doing, and a button to call them.
	 * @type {{ rider: {
	 *   name: string, phone: string | null, vehicleType: string | null,
	 *   stage: 'to_restaurant' | 'at_restaurant' | 'to_customer', stopsBefore: number,
	 *   position: { updatedAt: number } | null } }}
	 */
	let { rider } = $props();

	const initial = $derived((rider.name || '?').charAt(0).toUpperCase());
	const doing = $derived(
		rider.stage !== 'to_customer'
			? t('track.rider_' + rider.stage, { name: rider.name })
			: rider.stopsBefore > 1
				? t('track.riderOthersFirst', { name: rider.name, n: rider.stopsBefore })
				: rider.stopsBefore === 1
					? t('track.riderOtherFirst', { name: rider.name })
					: t('track.rider_to_customer', { name: rider.name })
	);
	const vehicle = $derived(rider.vehicleType ? t('track.riderVehicle_' + rider.vehicleType) : '');
	/* A phone that stopped reporting (no signal, flat battery) should not look
	   like a rider standing still. */
	const minutesOld = $derived(
		rider.position ? Math.floor(((clock.now || Date.now()) - rider.position.updatedAt) / 60000) : 0
	);
	const tel = $derived(rider.phone ? 'tel:' + rider.phone.replace(/[^\d+]/g, '') : '');
</script>

<section class="card rider-card" aria-live="polite">
	<span class="rc-avatar" aria-hidden="true">{initial}<span class="rc-badge"><Icon name="bike" size={12} /></span></span>
	<div class="rc-who">
		<strong>{doing}</strong>
		{#if vehicle || minutesOld >= 2}
			<span class="rc-sub">
				{vehicle}{#if vehicle && minutesOld >= 2}{' · '}{/if}{#if minutesOld >= 2}{t('track.riderUpdated', { n: minutesOld })}{/if}
			</span>
		{/if}
	</div>
	{#if tel}
		<a class="rc-call" href={tel} aria-label={t('track.callRider', { name: rider.name })} title={t('track.callRider', { name: rider.name })}>
			<Icon name="phone" size={20} />
		</a>
	{/if}
</section>

<style>
	.rider-card {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px;
	}
	.rc-avatar {
		position: relative;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		display: grid;
		place-items: center;
		background: var(--dark);
		color: #fff;
		font-size: 20px;
		font-weight: 700;
		flex: none;
	}
	.rc-badge {
		position: absolute;
		right: -6px;
		bottom: -6px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--brand);
		color: #fff;
		border: 2px solid #fff;
	}
	.rc-who {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		flex: 1;
	}
	.rc-who strong {
		font-size: 15.5px;
		font-weight: 600;
		line-height: 1.3;
	}
	.rc-sub {
		font-size: 13.5px;
		color: var(--muted);
	}
	.rc-call {
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--brand);
		color: #fff;
		box-shadow: var(--shadow-sm);
	}
	.rc-call:hover {
		background: var(--brand-dark);
	}
	.rc-call:focus-visible {
		outline: 2px solid var(--brand-dark);
		outline-offset: 2px;
	}
</style>
