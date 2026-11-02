<script>
	import { browser } from '#app/env';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { toastError } from '#lib/layers.svelte.js';
	import { loadReceiptData } from '#lib/order/receipt.js';
	import {
		buildReceiptModel,
		downloadReceiptPdf,
		resolveReceiptLabels
	} from '#lib/order/receiptPdf.js';

	/** @type {{ orderId: string, close: () => void }} */
	let { orderId, close } = $props();

	/** @type {import('#lib/order/receipt.js').ReceiptData | null} */
	let data = $state(null);
	let downloading = $state(false);

	const locale = $derived(getLocale() === 'en' ? 'en' : 'sv');
	const model = $derived(data ? buildReceiptModel(data, resolveReceiptLabels(), locale) : null);

	$effect(() => {
		if (!browser || !orderId) return;
		let live = true;
		loadReceiptData(orderId).then(
			(/** @type {import('#lib/order/receipt.js').ReceiptData | null} */ d) => {
				if (!live) return;
				if (d) data = d;
				else {
					toastError(m.receipt_failed());
					close();
				}
			},
			() => {
				if (!live) return;
				toastError(m.receipt_failed());
				close();
			}
		);
		return () => {
			live = false;
		};
	});

	async function onDownload() {
		if (!data || downloading) return;
		downloading = true;
		try {
			const ok = await downloadReceiptPdf(data);
			if (!ok) toastError(m.receipt_failed());
		} finally {
			downloading = false;
		}
	}

</script>

{#if model}
	<div class="receipt-sheet" id="receipt-sheet">
		<h2 class="rc-title">{model.title}</h2>
		<p class="rc-meta">{model.orderNumberLine}<br />{model.dateLine}{#if model.deliveredLine}<br />{model.deliveredLine}{/if}</p>
		<p class="rc-rest"><strong>{model.restaurantName}</strong>{#if model.restaurantAddress}<br />{model.restaurantAddress}{/if}</p>
		{#if model.deliveryLines.length}
			<p class="rc-delivery">
				<strong>{model.deliveryTitle}</strong>{#each model.deliveryLines as dl (dl)}<br />{dl}{/each}
			</p>
		{/if}
		<ul class="rc-items">
			{#each model.itemLines as line (line.title)}
				<li>
					<span class="rc-line"><span>{line.title}</span><span>{line.amount}</span></span>
					{#each line.details as detail (detail)}
						<span class="rc-detail">{detail}</span>
					{/each}
				</li>
			{/each}
		</ul>
		<p class="rc-row"><span>{model.subtotalLabel}</span><span>{model.subtotalAmount}</span></p>
		<p class="rc-row"><span>{model.deliveryFeeLabel}</span><span>{model.deliveryFeeAmount}</span></p>
		{#if model.discountLabel && model.discountAmount}
			<p class="rc-row"><span>{model.discountLabel}</span><span>{model.discountAmount}</span></p>
		{/if}
		{#if model.vatLines.length}
			<p class="rc-row rc-vat"><span>{model.vatTitle}</span></p>
			{#each model.vatLines as vat (vat)}
				<p class="rc-row rc-vat-line"><span>{vat}</span></p>
			{/each}
		{/if}
		<p class="rc-row rc-total"><span>{model.totalLabel}</span><span>{model.totalAmount}</span></p>
		<p class="rc-row"><span>{model.paymentTitle}</span><span>{model.paymentLine}</span></p>
	</div>
	<div class="receipt-actions">
		<button class="btn btn-primary" onclick={onDownload} disabled={downloading || !model}>
			{m.nui_receipt_download()}
		</button>
	</div>
{:else}
	<div role="status"><span class="sr-only">{m.loading()}</span><div class="skels sm" aria-hidden="true"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div></div>
{/if}

<style>
	.rc-title {
		margin: 0 0 4px;
		font-size: 22px;
	}
	.rc-meta,
	.rc-rest,
	.rc-delivery {
		margin: 8px 0 0;
		font-size: 14px;
		line-height: 1.5;
	}
	.rc-items {
		list-style: none;
		margin: 12px 0 0;
		padding: 12px 0 0;
		border-top: 1px solid var(--border);
	}
	.rc-items li {
		margin: 8px 0 0;
	}
	.rc-line,
	.rc-row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 14px;
		margin: 4px 0 0;
	}
	.rc-detail {
		display: block;
		font-size: 13px;
		color: var(--muted);
		margin: 1px 0 0 12px;
	}
	.rc-vat {
		margin-top: 10px;
		font-weight: 700;
	}
	.rc-vat-line {
		color: var(--muted);
	}
	.rc-total {
		border-top: 1px solid var(--border);
		margin-top: 8px;
		padding-top: 8px;
		font-weight: 700;
		font-size: 16px;
	}
	.receipt-actions {
		display: flex;
		gap: 10px;
		margin-top: 18px;
	}
	.receipt-actions .btn {
		flex: 1;
	}
</style>
