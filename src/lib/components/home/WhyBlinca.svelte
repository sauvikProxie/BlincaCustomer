<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/stores/language.svelte.js';

	/** Value props plus a few live numbers from the catalogue.
	 *  @type {{ kitchens: number, rating: number, eta: number }} */
	let { kitchens, rating, eta } = $props();

	const FEATURES = [
		{ id: '1', icon: 'home' },
		{ id: '2', icon: 'bike' },
		{ id: '3', icon: 'shield' },
		{ id: '4', icon: 'help' }
	];
</script>

<section class="sec why" aria-labelledby="why-title">
	<div class="why-card">
		<div class="why-head">
			<h2 class="h2" id="why-title">{t('home3.whyTitle')}</h2>
			<dl class="why-stats">
				{#if kitchens}
					<div><dt>{t('home3.statKitchens')}</dt><dd>{kitchens}</dd></div>
				{/if}
				{#if rating}
					<div>
						<dt>{t('home3.statRating')}</dt>
						<dd><Icon name="star" size={18} cls="filled" />{rating.toFixed(1)}</dd>
					</div>
				{/if}
				{#if eta}
					<div><dt>{t('home3.statEta')}</dt><dd>{t('home3.minutes', { n: eta })}</dd></div>
				{/if}
			</dl>
		</div>
		<ul class="why-grid">
			{#each FEATURES as f (f.id)}
				<li>
					<span class="why-ic"><Icon name={f.icon} size={20} /></span>
					<strong>{t('home3.why' + f.id + 'Title')}</strong>
					<p>{t('home3.why' + f.id + 'Text')}</p>
				</li>
			{/each}
		</ul>
	</div>
</section>
