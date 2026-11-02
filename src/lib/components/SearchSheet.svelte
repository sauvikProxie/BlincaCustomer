<script>
	import Icon from '#lib/components/Icon.svelte';
	import AddressButton from '#lib/components/AddressButton.svelte';
	import SearchBox from '#lib/components/SearchBox.svelte';
	import { t } from '#lib/stores/language.svelte.js';

</script>

<div class="d-head">
	<h2>{t('nav.search')}</h2>
	<button class="icon-btn sm" data-close aria-label={t('common.close')}
		><Icon name="x" size={18} /></button
	>
</div>
<div class="d-body">
	<AddressButton cls="sheet-addr" />
	<SearchBox autofocus inline />
</div>
