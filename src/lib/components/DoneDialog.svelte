<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { kr } from '#lib/format.js';

	/** @type {{ orderId: string, name: string, eta: number, mode: string, total: number }} */
	let { orderId, name, eta, mode, total } = $props();
</script>

<div class="done-modal">
	<span class="done-ic"><Icon name="check" size={30} /></span>
	<h2>{t('done.title')}</h2>
	<p>
		{t(mode === 'delivery' ? 'done.textDelivery' : 'done.textPickup', { id: orderId, name, eta })}
	</p>
	<p class="muted">{t('done.paid', { total: kr(total) })}</p>
	<div class="done-actions">
		<a class="btn btn-secondary btn-lg grow" href="/account?tab=orders">{t('done.orders')}</a>
		<!-- svelte-ignore a11y_autofocus (dialog/form: focus moves on open, as intended) -->
		<a class="btn btn-primary btn-lg grow" href="/" autofocus>{t('done.home')}</a>
	</div>
</div>
