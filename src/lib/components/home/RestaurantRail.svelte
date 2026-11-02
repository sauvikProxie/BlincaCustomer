<script>
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import RestaurantCard from '#lib/components/RestaurantCard.svelte';
	import { t } from '#lib/stores/language.svelte.js';

	/** A titled, horizontally scrolling row of restaurant cards.
	 *  @type {{ id: string, icon: string, title: string, sub: string, list: any[], onSeeAll?: () => void }} */
	let { id, icon, title, sub, list, onSeeAll } = $props();

	/** @type {HTMLElement | undefined} */
	let track = $state();
	let canPrev = $state(false);
	let canNext = $state(false);

	function update() {
		if (!track) return;
		canPrev = track.scrollLeft > 4;
		canNext = track.scrollLeft + track.clientWidth < track.scrollWidth - 4;
	}
	/** @param {number} dir */
	function page(dir) {
		track?.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: 'smooth' });
	}

	onMount(() => {
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	});
	$effect(() => {
		void list.length;
		queueMicrotask(update);
	});
</script>

{#if list.length}
	<section class="sec hm-rail" aria-labelledby="rail-{id}">
		<div class="sec-head">
			<div class="hm-rail-title">
				<span class="hm-rail-ic"><Icon name={icon} size={18} cls={icon === 'star' ? 'filled' : ''} /></span>
				<div>
					<h2 class="h2" id="rail-{id}">{title}</h2>
					<p class="sec-sub">{sub}</p>
				</div>
			</div>
			<div class="hm-rail-ctrl">
				{#if onSeeAll}
					<button class="btn-link" onclick={onSeeAll}>{t('home3.seeAll')}</button>
				{/if}
				<button
					class="icon-btn sm outline"
					disabled={!canPrev}
					onclick={() => page(-1)}
					aria-label={t('home3.prev')}><Icon name="left" size={18} /></button
				>
				<button
					class="icon-btn sm outline"
					disabled={!canNext}
					onclick={() => page(1)}
					aria-label={t('home3.next')}><Icon name="arrow" size={18} /></button
				>
			</div>
		</div>
		<div class="hm-rail-track" bind:this={track} onscroll={update}>
			{#each list as r (r.slug)}
				<div class="hm-rail-item"><RestaurantCard {r} /></div>
			{/each}
		</div>
	</section>
{/if}
