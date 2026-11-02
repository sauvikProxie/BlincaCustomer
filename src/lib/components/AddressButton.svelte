<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { address } from '#lib/stores/address.svelte.js';
	import { openAddressModal } from '#lib/ui.js';

	/** @type {{ cls?: string }} */
	let { cls = '' } = $props();

	const a = $derived(address());
</script>

<button class="addr-btn {cls}" onclick={openAddressModal} aria-haspopup="dialog">
	<Icon name="pin" size={20} />
	<span class="addr-text"
		><small>{t('header.deliveryAddress')}</small><strong>{a.street}, {a.city}</strong></span
	>
	<Icon name="down" size={18} cls="muted-ic" />
</button>
