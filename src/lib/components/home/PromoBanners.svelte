<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { infoUrl } from '#lib/format.js';

	/** Editorial banners. No prices or discounts here: real offers live in
	 *  the deals section, which reads the backend's promos.
	 *  @type {{ onBrowse: () => void, onMood: (id: string) => void }} */
	let { onBrowse, onMood } = $props();

	const BANNERS = [
		{ id: '1', theme: 'red', image: '/food/ramen-2-800.webp' },
		{ id: '2', theme: 'dark', image: '/food/burger-2-800.webp', href: infoUrl('how') },
		{ id: '3', theme: 'pink', image: '/food/cake-1-800.webp' }
	];
</script>

{#snippet body(/** @type {any} */ b)}
	<span class="hm-promo-text">
		<strong>{t('home3.banner' + b.id + 'Title')}</strong>
		<span>{t('home3.banner' + b.id + 'Text')}</span>
		<span class="hm-promo-cta">{t('home3.banner' + b.id + 'Cta')}<Icon name="arrow" size={16} /></span>
	</span>
	<span class="hm-promo-img"><Img src={b.image} /></span>
{/snippet}

<section class="sec hm-promo" aria-label={t('home3.promoRegion')}>
	<ul class="hm-promo-row">
		{#each BANNERS as b (b.id)}
			<li>
				{#if b.href}
					<a class="hm-promo-card theme-{b.theme}" href={b.href}>{@render body(b)}</a>
				{:else}
					<button
						class="hm-promo-card theme-{b.theme}"
						onclick={() => (b.id === '3' ? onMood('fika') : onBrowse())}>{@render body(b)}</button
					>
				{/if}
			</li>
		{/each}
	</ul>
</section>
