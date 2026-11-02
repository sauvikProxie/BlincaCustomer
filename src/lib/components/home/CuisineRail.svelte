<script>
	import Img from '#lib/components/Img.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { L } from '#lib/format.js';

	/** Round photo tiles, one per cuisine that has at least one kitchen.
	 *  @type {{ cuisines: any[], counts: Record<string, number>, selected: string[], onPick: (id: string) => void }} */
	let { cuisines, counts, selected, onPick } = $props();

	const shown = $derived(cuisines.filter((c) => counts[c.id]));
</script>

{#if shown.length}
	<section class="sec cz" aria-labelledby="cz-title">
		<div class="sec-head">
			<div>
				<h2 class="h2" id="cz-title">{t('home3.cuisinesTitle')}</h2>
				<p class="sec-sub">{t('home3.cuisinesSub')}</p>
			</div>
		</div>
		<ul class="cz-rail">
			{#each shown as c (c.id)}
				{@const on = selected.includes(c.id)}
				<li>
					<button class="cz-tile" class:is-on={on} aria-pressed={on} onclick={() => onPick(c.id)}>
						<span class="cz-img"><Img src={c.image} /></span>
						<strong>{L(c.name, lang())}</strong>
						<small
							>{counts[c.id] === 1
								? t('home3.place1')
								: t('home3.places', { n: counts[c.id] })}</small
						>
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}
