<script>
	import Img from '#lib/components/Img.svelte';
	import AddControl from '#lib/components/AddControl.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { item, restaurant } from '#lib/stores/catalog.svelte.js';
	import { L, dishPrice, restaurantUrl } from '#lib/format.js';

	/** Rows only — the parent page provides the <ol class="trend duo-scroll"> wrapper.
	 * @type {{ rows: Array<{ x: any, i: number }> }} */
	let { rows } = $props();
</script>

{#each rows as { x, i } (`${x[0]}|${x[1]}`)}
	{@const r = restaurant(x[0])}
	{@const it = item(x[0], x[1])}
	{#if r && it}
		<li class="tr">
			<span class="rk">{i + 1}</span>
			<a class="th" href={restaurantUrl(r.slug, it.id)} tabindex="-1" aria-hidden="true"
				><Img src={it.image} /></a
			>
			<div class="grow">
				<strong><a href={restaurantUrl(r.slug, it.id)}>{L(it.name, lang())}</a></strong>
				<small>{dishPrice(it)} · {r.name}</small>
				<span class="up">▲ {t('h2.thisHour', { n: x[2] })}</span>
			</div>
			<div class="tr-ctrl"><AddControl slug={r.slug} itemId={it.id} /></div>
		</li>
	{/if}
{/each}
