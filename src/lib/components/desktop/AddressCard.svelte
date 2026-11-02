<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { address } from '#lib/stores/address.svelte.js';
	import { getSiteData } from '#lib/stores/catalog.svelte.js';
	import { openAddressModal } from '#lib/ui.js';

	const a = $derived(address());
	/* Real delivery ETA = fastest currently-open restaurant. */
	const eta = $derived.by(() => {
		const etas = getSiteData()
			.restaurants.filter((r) => r.status === 'open' && typeof r.eta === 'number')
			.map((r) => r.eta);
		return etas.length ? Math.min(...etas) : 30;
	});
</script>

<button class="addr-card" onclick={openAddressModal} aria-haspopup="dialog" aria-label="{t('eta.delivery', { n: eta })} {a.street}. {t('addr.choose')}"
>
	<span class="pin" aria-hidden="true"><Icon name="pin" size={18} /></span>
	<span class="txt">
		<small class="eta">● {t('eta.delivery', { n: eta })}</small>
		<strong class="street">{a.street}</strong>
	</span>
	<Icon name="down" size={16} cls="chev" />
</button>

<style>
	.addr-card {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 46px;
		padding: 0 10px 0 6px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: #fff;
		text-align: left;
		flex: none;
		transition: border-color 0.15s;
	}
	.addr-card:hover {
		border-color: var(--border-strong);
	}
	.pin {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--pink);
		color: var(--brand);
		display: grid;
		place-items: center;
		flex: none;
	}
	.txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.15;
	}
	.eta {
		font-size: 11.5px;
		font-weight: 700;
		color: var(--green);
		white-space: nowrap;
	}
	.street {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.addr-card :global(.chev) {
		color: var(--muted);
		flex: none;
	}
	/* Tablet: hide the green ETA line. */
	@media (max-width: 1080px) {
		.eta {
			display: none;
		}
		.street {
			max-width: 120px;
		}
	}
	/* Narrow tablet: pin + chevron only, so the island fits 820px without horizontal scroll. */
	@media (max-width: 900px) {
		.txt {
			display: none;
		}
		.addr-card {
			gap: 6px;
		}
	}
</style>
