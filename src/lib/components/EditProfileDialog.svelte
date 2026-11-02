<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { user, setUser, saveProfile } from '#lib/stores/user.svelte.js';
	import { isDesignCheck } from '#lib/stores/session.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { toast } from '#lib/layers.svelte.js';

	/** @type {{ close: () => void }} */
	let { close } = $props();

	const DESIGN = isDesignCheck();
	const u = user() || { name: '', email: '', phone: '' };
	let name = $state(u.name || '');
	let email = $state(u.email || '');
	let phone = $state(u.phone || '');
	let err = $state('');
	let saving = $state(false);

	/** @param {SubmitEvent} e */
	async function submit(e) {
		e.preventDefault();
		if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			err = t('form.fix');
			return;
		}
		// Design-check: the source's local profile write, verbatim.
		if (DESIGN) {
			setUser({ name: name.trim(), email: email.trim(), phone: phone.trim() });
			close();
			toast(t('acc.saved'));
			return;
		}
		// Real mode: the email is the login identifier and only the (disabled)
		// change-email flow can move it — block instead of silently ignoring.
		if (email.trim().toLowerCase() !== (u.email || '').toLowerCase()) {
			err = m.profile_email_locked();
			return;
		}
		if (saving) return;
		saving = true;
		err = '';
		const ok = await saveProfile({ name: name.trim(), phone: phone.trim() });
		saving = false;
		if (!ok) {
			err = m.profile_save_failed();
			return;
		}
		close();
		toast(t('acc.saved'));
	}
</script>

<form class="modal-pad" novalidate onsubmit={submit}>
	<div class="m-head">
		<h2>{t('acc.edit')}</h2>
		<button type="button" class="icon-btn sm" data-close aria-label={t('common.close')}
			><Icon name="x" size={18} /></button
		>
	</div>
	<label class="label" for="p-name">{t('contact.name')}</label>
	<!-- svelte-ignore a11y_autofocus (dialog/form: focus moves on open, as intended) -->
	<input class="field" id="p-name" required autofocus bind:value={name} />
	<label class="label mt-12" for="p-email">{t('contact.email')}</label>
	<input class="field" id="p-email" type="email" required bind:value={email} />
	<label class="label mt-12" for="p-phone">{t('co.phone')}</label>
	<input class="field" id="p-phone" type="tel" bind:value={phone} />
	{#if err}<p class="form-err" id="form-err" role="alert">{err}</p>{/if}
	<div class="confirm-actions">
		<button type="button" class="btn btn-ghost" data-close>{t('common.cancel')}</button>
		<button class="btn btn-primary" disabled={saving}>{t('acc.save')}</button>
	</div>
</form>
