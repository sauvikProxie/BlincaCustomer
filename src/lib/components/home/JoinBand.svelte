<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { infoUrl } from '#lib/format.js';
</script>

<section class="sec join" aria-label={t('home3.joinRegion')}>
	<a class="join-card" href="https://partner.blinca.se/apply">
		<span class="join-img"><Img src="/food/pizza-3-800.webp" /></span>
		<span class="join-body">
			<span class="join-ic"><Icon name="briefcase" size={18} /></span>
			<strong>{t('home3.partnerTitle')}</strong>
			<span>{t('home3.partnerText')}</span>
			<span class="btn btn-primary btn-sm">{t('home3.partnerCta')}</span>
		</span>
	</a>
	<a class="join-card dark" href={infoUrl('contact')}>
		<span class="join-img"><Img src="/food/bowl-2-800.webp" /></span>
		<span class="join-body">
			<span class="join-ic"><Icon name="bike" size={18} /></span>
			<strong>{t('home3.riderTitle')}</strong>
			<span>{t('home3.riderText')}</span>
			<span class="btn btn-secondary btn-sm">{t('home3.riderCta')}</span>
		</span>
	</a>
</section>
