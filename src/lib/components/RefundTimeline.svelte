<script>
	import { m } from '#lib/paraglide/messages.js';
	import { formatMoney } from '#lib/money.js';
	import { refundSteps } from '#lib/order/refundTimeline.js';

	/** @type {{ refund: { status: string, amountCents: number } }} */
	let { refund } = $props();

	const label = {
		requested: m.order_refund_step_requested,
		processing: m.order_refund_step_processing,
		succeeded: m.order_refund_step_succeeded,
		failed: m.order_refund_step_failed
	};
</script>

<div class="rt" data-testid="refund-timeline" data-status={refund.status}>
	<p class="rt-title">{m.order_refund_timeline_title({ amount: formatMoney(refund.amountCents) })}</p>
	<ol class="rt-steps">
		{#each refundSteps(refund.status) as s (s.key)}
			<li class="rt-step {s.state}" aria-current={s.state === 'current' ? 'step' : undefined}>
				<span class="rt-dot" aria-hidden="true"></span>{label[s.key]()}
			</li>
		{/each}
	</ol>
</div>

<style>
	.rt {
		margin-top: 10px;
		text-align: left;
	}
	.rt-title {
		margin: 0 0 6px;
		font-weight: 700;
		font-size: 14px;
	}
	.rt-steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.rt-step {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13.5px;
		color: var(--muted);
	}
	.rt-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 2px solid var(--border-strong);
		flex: none;
	}
	.rt-step.done {
		color: var(--text-2);
	}
	.rt-step.done .rt-dot {
		background: var(--green);
		border-color: var(--green);
	}
	.rt-step.current {
		color: var(--text);
		font-weight: 600;
	}
	.rt-step.current .rt-dot {
		border-color: var(--brand);
	}
	.rt-step.failed {
		color: var(--brand-dark);
		font-weight: 600;
	}
	.rt-step.failed .rt-dot {
		background: var(--brand);
		border-color: var(--brand);
	}
</style>
