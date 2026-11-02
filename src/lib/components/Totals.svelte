<script>
	import { t } from '#lib/stores/language.svelte.js';
	import { kr, decimal, prKr } from '#lib/format.js';

	/** @type {{ pr: { sub: number, fee: number, discount: number, total: number, vat: number, loading?: boolean, stale?: boolean, promo: { code: string, valid: boolean, msg: string, label?: string } | null, mode: string } }} */
	let { pr } = $props();
</script>

<div class="sum-row" class:pr-stale={pr.stale} aria-busy={pr.loading || pr.stale || undefined}><span>{t('cart.subtotal')}</span><span>{prKr(pr, pr.sub)}</span></div>
{#if pr.mode === 'delivery'}
	<div class="sum-row" class:pr-stale={pr.stale}><span>{t('co.deliveryFee')}</span><span>{prKr(pr, pr.fee)}</span></div>
{/if}
{#if pr.discount && pr.promo}
	<div class="sum-row good" class:pr-stale={pr.stale}>
		<span>{t('promo.discount')} ({pr.promo.code})</span><span>−{kr(pr.discount)}</span>
	</div>
{/if}
<div class="sum-total" class:pr-stale={pr.stale}><span>{t('co.total')}</span><span>{prKr(pr, pr.total)}</span></div>
{#if !pr.loading}<p class="vat" class:pr-stale={pr.stale}>{t('co.vat', { vat: decimal(pr.vat) })}</p>{/if}
