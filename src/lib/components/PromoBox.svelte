<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { setPromo, pricing, promoContext } from '#lib/stores/cart.svelte.js';
	import { promoDraft, refreshPreview, setPromoDraft } from '#lib/stores/promo.svelte.js';
	import { toast } from '#lib/layers.svelte.js';

	let applying = $state(false);
	let code = $state(promoDraft());
	$effect(() => {
		const d = promoDraft();
		if (d) code = d;
	});
	const promo = $derived(pricing().promo);

	/** @param {SubmitEvent} e */
	async function apply(e) {
		e.preventDefault();
		const c = code.trim().toUpperCase();
		if (!c || applying) return;
		applying = true;
		setPromo(c);
		setPromoDraft('');
		// Real mode: validity only exists once checkout.preview answers, and the
		// regular refresh is debounced — fetch now so the confirmation isn't
		// lost. Design-check resolves locally (refreshPreview is a no-op there).
		try {
			await refreshPreview(promoContext());
		} finally {
			applying = false;
		}
		const p = pricing().promo;
		if (p && p.valid && p.code === c) toast(t('promo.applied', { code: c }));
	}
</script>

{#if promo && promo.valid}
	<div class="promo-row is-ok">
		<Icon name="tag" size={18} /><span><b>{promo.code}</b> · {promo.label}</span><button
			class="btn-link sm"
			onclick={() => setPromo(null)}>{t('cart.remove')}</button
		>
	</div>
{:else}
	<form class="promo-row" onsubmit={apply}>
		<Icon name="tag" size={18} /><input
			class="promo-input"
			name="code"
			placeholder={t('promo.placeholder')}
			aria-label={t('promo.placeholder')}
			value={promo ? promo.code : ''}
			oninput={(e) => (code = e.currentTarget.value)}
			autocomplete="off"
		/><button class="btn btn-secondary btn-sm" disabled={applying}>{applying ? t('co.processing') : t('promo.apply')}</button>
	</form>
	{#if promo && !promo.valid && promo.msg}
		<p class="form-err" role="alert">{promo.msg}</p>
	{/if}
{/if}
