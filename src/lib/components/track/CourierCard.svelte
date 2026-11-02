<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';

	/** @type {{ courier: any }} */
	let { courier } = $props();

	const initial = $derived((courier?.name || '?').charAt(0).toUpperCase());
	const vehicle = $derived(t('track.vehicle.' + (courier?.vehicle || 'bike')));
	/* masked contact links (the real API would return one-time masked numbers) */
	const tel = 'tel:+46700000000';
	const sms = 'sms:+46700000000';
</script>

<section class="card courier-card">
	<div class="cc-head">
		<span class="cc-avatar">{initial}<span class="cc-badge"><Icon name="bike" size={12} /></span></span>
		<div class="cc-who">
			<strong>{t('track.courierDelivering', { name: courier.name })}</strong>
			<span class="cc-rate"><Icon name="star" size={14} cls="cc-star" />{t('track.ratingVehicle', { rating: courier.rating, vehicle })}</span>
		</div>
	</div>
	<div class="cc-actions">
		<a class="btn btn-secondary cc-btn" href={tel} aria-label={t('track.call')}>{t('track.call')}</a>
		<a class="btn btn-secondary cc-btn" href={sms} aria-label={t('track.message')}>{t('track.message')}</a>
	</div>
	<p class="cc-private">{t('track.privateNumber')}</p>
</section>

<style>
	.cc-head {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 16px 0;
	}
	.cc-avatar {
		position: relative;
		width: 56px;
		height: 56px;
		border-radius: 16px;
		display: grid;
		place-items: center;
		background: var(--dark);
		color: #fff;
		font-size: 20px;
		font-weight: 700;
		flex: none;
	}
	.cc-badge {
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
	.cc-who {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.cc-who strong {
		font-size: 15.5px;
		font-weight: 600;
	}
	.cc-rate {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 13.5px;
		color: var(--muted);
	}
	.cc-rate :global(.cc-star) {
		color: #f5a623;
	}
	.cc-actions {
		display: flex;
		gap: 10px;
		padding: 14px 16px 0;
	}
	.cc-btn {
		flex: 1;
		height: 44px;
	}
	.cc-private {
		margin: 10px 0 0;
		padding: 0 16px 16px;
		font-size: 12.5px;
		color: var(--muted);
	}
</style>
