<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { restaurant } from '#lib/stores/catalog.svelte.js';
	import { restaurantUrl } from '#lib/format.js';
	import { toast } from '#lib/layers.svelte.js';

	/** @type {{ slug: string, close: () => void }} */
	let { slug, close } = $props();

	const r = $derived(restaurant(slug));

	function minutes(/** @type {string} */ hhmm) {
		const p = hhmm.split(':');
		return +p[0] * 60 + +p[1];
	}
	function opensToday(/** @type {any} */ r) {
		const d = new Date();
		return minutes(r.opensAt) > d.getHours() * 60 + d.getMinutes();
	}
	const when = $derived(
		r ? (opensToday(r) ? t('h2.todayAt', { time: r.opensAt }) : t('h2.tomorrowAt', { time: r.opensAt })) : ''
	);

	function notify() {
		if (!r) return;
		close();
		toast(t('h2.notified', { name: r.name, time: r.opensAt }));
	}
</script>

{#if r}
	<div class="modal-pad">
		<div class="m-head">
			<h2>{t('h2.schedTitle', { name: r.name })}</h2>
			<button class="icon-btn sm" data-close aria-label={t('common.close')}
				><Icon name="x" size={18} /></button
			>
		</div>
		<div class="sched-hero">
			<span class="th"><Img src={r.image} /></span>
			<div>
				<strong>{t('h2.opensWhen', { when })}</strong><small>{t('h2.schedText')}</small>
			</div>
		</div>
		<div class="confirm-actions">
			<button class="btn btn-secondary" onclick={notify}
				><Icon name="clock" size={16} />{t('h2.notify')}</button
			>
			<!-- svelte-ignore a11y_autofocus (dialog/form: focus moves on open, as intended) -->
			<a class="btn btn-primary" href={restaurantUrl(r.slug)} autofocus onclick={close}
				>{t('h2.browseMenu')}</a
			>
		</div>
	</div>
{/if}
