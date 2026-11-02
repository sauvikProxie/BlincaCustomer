<script>
	import { t } from '#lib/stores/language.svelte.js';

	/** @type {{ title: string, text: string, ok: string, cancel?: string, onConfirm: () => void, close: () => void }} */
	let { title, text, ok, cancel, onConfirm, close } = $props();
</script>

<div class="confirm">
	<h2>{title}</h2>
	<p>{text}</p>
	<div class="confirm-actions">
		<!-- svelte-ignore a11y_autofocus (dialog: focus lands on the safe choice, so a stray Enter never confirms) -->
		<button class="btn btn-ghost" autofocus onclick={close}>{cancel || t('common.cancel')}</button>
		<button
			class="btn btn-primary"
			onclick={() => {
				close();
				onConfirm();
			}}>{ok}</button>
	</div>
</div>
