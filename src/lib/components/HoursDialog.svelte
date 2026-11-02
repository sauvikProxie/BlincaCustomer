<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { restaurant } from '#lib/stores/catalog.svelte.js';
	import { kr, dayRanges } from '#lib/format.js';

	/** @type {{ slug: string }} */
	let { slug } = $props();

	// Read once: a mounted dialog never switches restaurant.
	// svelte-ignore state_referenced_locally
	const r = restaurant(slug);
	const names =
		lang() === 'sv'
			? ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']
			: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const today = (new Date().getDay() + 6) % 7;
	/** Weekly rows; today's row shows a special day when one is set for today. */
	const rows = $derived.by(() => {
		if (!r) return [];
		const list = r.hours.slice();
		list[today] = dayRanges(r, new Date())[0] ?? null;
		return list;
	});
</script>

{#if r}
	<div class="modal-pad">
		<div class="m-head">
			<h2>{r.name}</h2>
			<button class="icon-btn sm" data-close aria-label={t('common.close')}
				><Icon name="x" size={18} /></button
			>
		</div>
		<div class="info-rows">
			<p><Icon name="pin" size={17} />{r.address}</p>
			<p>
				<Icon name="bike" size={17} />{t('rest.deliveryEta', { n: r.eta + '–' + (r.eta + 10) })} · {r.fee
					? kr(r.fee)
					: t('rest.free')}
			</p>
			{#if r.minOrder}<p>
					<Icon name="receipt" size={17} />{t('rest.minOrder')}: {kr(r.minOrder)}
				</p>{/if}
		</div>
		<h3 class="h3 mt-16">{t('rest.hoursTitle')}</h3>
		<table class="hours">
			<tbody>
				{#each rows as h, i}
					<tr class:is-today={i === today}>
						<th scope="row">{names[i]}{#if i === today}{' '}<span>({t('rest.today')})</span>{/if}</th>
						<td>{h ? h[0] + '–' + h[1] : m.rest_hours_closed_day()}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
