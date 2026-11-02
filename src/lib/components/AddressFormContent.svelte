<script>
	import Icon from '#lib/components/Icon.svelte';
	import AddressMapPicker from '#lib/components/AddressMapPicker.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { addAddress, updateAddress } from '#lib/stores/address.svelte.js';
	import { toast } from '#lib/layers.svelte.js';
	import { postcodeDigits } from '#lib/postcode.js';

	/** @type {{ close: () => void, onSaved?: ((a: any) => void) | null, address?: any }} */
	let { close, onSaved = null, address = null } = $props();

	/* The same form serves add (no row) and edit (prefilled row, save in place).
	   Read once: the row never changes under a mounted form. */
	// svelte-ignore state_referenced_locally
	const draft = address ?? {};
	let label = $state(draft.label ?? '');
	let street = $state(draft.street ?? '');
	let zip = $state(draft.zip ?? '');
	let city = $state(draft.city ?? '');
	let lat = $state(draft.lat ?? null);
	let lng = $state(draft.lng ?? null);
	let err = $state('');
	let saving = $state(false);
	/** @type {string[]} */
	let bad = $state([]);

	/** @param {SubmitEvent} e */
	async function submit(e) {
		e.preventDefault();
		const fields = [
			{ id: 'na-street', v: street },
			{ id: 'na-zip', v: zip },
			{ id: 'na-city', v: city }
		];
		bad = fields.filter((f) => !f.v.trim()).map((f) => f.id);
		if (bad.length) {
			err = t('form.fix');
			document.getElementById(bad[0])?.focus();
			return;
		}
		if (postcodeDigits(zip) === null) {
			bad = ['na-zip'];
			err = t('addr.zipBad');
			document.getElementById('na-zip')?.focus();
			return;
		}
		if (saving) return;
		saving = true;
		err = '';
		const data = {
			label: label.trim() || t('addr.other'),
			street: street.trim(),
			zip: /** @type {string} */ (postcodeDigits(zip)),
			city: city.trim(),
			extraEta: address?.extraEta ?? 10,
			lat,
			lng
		};
		try {
			const a = address ? await updateAddress(address.id, data) : await addAddress(data);
			close();
			toast(t('addr.saved'));
			if (onSaved) onSaved(a);
		} catch (ex) {
			console.warn('[addr] save failed', ex);
			err = t('addr.saveFailed');
		} finally {
			saving = false;
		}
	}
</script>

<form class="modal-pad" novalidate onsubmit={submit}>
	<div class="m-head">
		<h2>{t(address ? 'addr.editTitle' : 'addr.newTitle')}</h2>
		<button type="button" class="icon-btn sm" data-close aria-label={t('common.close')}
			><Icon name="x" size={18} /></button
		>
	</div>
	<label class="label" for="na-label">{t('addr.label')}</label>
	<input
		class="field"
		id="na-label"
		placeholder={t('addr.labelPh')}
		bind:value={label}
	/>
	<div class="mt-12">
		<AddressMapPicker bind:street bind:zip bind:city bind:lat bind:lng />
	</div>
	<label class="label mt-12" for="na-street">{t('co.street')}</label>
	<!-- svelte-ignore a11y_autofocus (dialog/form: focus moves on open, as intended) -->
	<input
		class="field"
		class:is-invalid={bad.includes('na-street')}
		aria-invalid={bad.includes('na-street') || undefined}
		aria-describedby={bad.includes('na-street') ? 'form-err' : undefined}
		id="na-street"
		autocomplete="street-address"
		required
		autofocus
		bind:value={street}
	/>
	<div class="two-col mt-12">
		<div>
			<label class="label" for="na-zip">{t('co.zip')}</label>
			<input
				class="field"
				class:is-invalid={bad.includes('na-zip')}
		aria-invalid={bad.includes('na-zip') || undefined}
		aria-describedby={bad.includes('na-zip') ? 'form-err' : undefined}
				id="na-zip"
				inputmode="numeric"
				autocomplete="postal-code"
				required
				bind:value={zip}
			/>
		</div>
		<div>
			<label class="label" for="na-city">{t('co.city')}</label>
			<input
				class="field"
				class:is-invalid={bad.includes('na-city')}
		aria-invalid={bad.includes('na-city') || undefined}
		aria-describedby={bad.includes('na-city') ? 'form-err' : undefined}
				id="na-city"
				autocomplete="address-level2"
				required
				bind:value={city}
			/>
		</div>
	</div>
	{#if err}<p class="form-err" id="form-err" role="alert">{err}</p>{/if}
	<div class="confirm-actions">
		<button type="button" class="btn btn-ghost" data-close>{t('common.cancel')}</button>
		<button class="btn btn-primary" disabled={saving}>{t('addr.save')}</button>
	</div>
</form>
