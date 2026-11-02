<script>
	import { goto } from '#app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { addressId, allAddresses, setAddress } from '#lib/stores/address.svelte.js';
	import { formatPostcode } from '#lib/postcode.js';
	import { deliverable } from '#lib/format.js';
	import { openAddressForm } from '#lib/ui.js';
	import { toast } from '#lib/layers.svelte.js';

	/** @type {{ close: () => void }} */
	let { close } = $props();

	const cur = $derived(addressId());
	/* Quick picker: the selected address first (the top three saved otherwise). */
	const all = $derived.by(() => {
		const list = allAddresses();
		const current = list.find((a) => a.id === cur);
		return (current ? [current, ...list.filter((a) => a.id !== current.id)] : list).slice(0, 3);
	});

	/** @param {{ id: string }} a */
	function iconFor(a) {
		return a.id === 'home' ? 'home' : a.id === 'work' ? 'briefcase' : 'pin';
	}

	/** @param {string} id */
	function pick(id) {
		setAddress(id);
		close();
		toast(t('addr.changed'));
	}
</script>

<div class="modal-pad">
	<div class="m-head">
		<h2>{t('addr.choose')}</h2>
		<button class="icon-btn sm" data-close aria-label={t('common.close')}
			><Icon name="x" size={18} /></button
		>
	</div>
	<div class="tile-list">
		{#each all as a (a.id)}
			{@const ok = deliverable(a)}
			<div class="addr-row">
				<button
					class="radio-tile"
					class:is-on={a.id === cur}
					onclick={() => pick(a.id)}
					aria-pressed={a.id === cur}
					><span class="rdot"></span><span class="ti"><Icon name={iconFor(a)} size={18} /></span>
					<span class="rt-text"
						><strong>{a.label}</strong><span
							>{a.street}, {formatPostcode(a.zip)} {a.city}{#if !ok}{' · '}{t('addr.outside')}{/if}</span
						></span
					></button
				>
				<button
					class="icon-btn sm"
					title={t('addr.edit')}
					aria-label="{t('addr.edit')}: {a.label}"
					onclick={(e) => {
						e.stopPropagation();
						openAddressForm(a);
					}}><Icon name="edit" size={15} /></button
				>
			</div>
		{/each}
	</div>
	<div class="addr-foot mt-12">
		<button
			class="btn btn-secondary btn-sm dashed"
			onclick={() => {
				close();
				openAddressForm();
			}}><Icon name="plus" size={16} />{t('addr.addNew')}</button
		>
		<button
			class="btn btn-secondary btn-sm"
			onclick={() => {
				close();
				goto('/account?tab=addresses');
			}}>{t('addr.all')}</button
		>
	</div>
</div>
