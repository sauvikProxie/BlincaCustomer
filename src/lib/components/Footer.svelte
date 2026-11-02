<script>
	import { t } from '#lib/stores/language.svelte.js';
	import { setLang } from '#lib/stores/language.svelte.js';
	import { infoUrl } from '#lib/format.js';

	/** @type {{ kind?: 'dark' | 'min' }} */
	let { kind = 'dark' } = $props();

	const year = new Date().getFullYear();
</script>

{#if kind === 'min'}
	<footer id="site-footer" class="ftr-min">
		<div class="wrap">
			<a href={infoUrl('help')}>{t('footer.help')}</a>
			<a href={infoUrl('terms')}>{t('footer.terms')}</a>
			<a href={infoUrl('privacy')}>{t('footer.privacy')}</a>
			<span aria-hidden="true">·</span>
			<span
				>{t('footer.language')}
				<button onclick={() => setLang('sv')}>Svenska</button> /
				<button onclick={() => setLang('en')}>English</button></span
			>
		</div>
	</footer>
{:else}
	<footer id="site-footer" class="ftr">
		<div class="wrap">
			<div class="ftr-grid">
				<div>
					<a class="ftr-logo" href="/"
						><img
							class="logo-svg"
							src="/img/logo-white.svg"
							alt="blinca"
							width="160"
							height="50"
						/></a
					>
					<p>{t('footer.tagline')}</p>
				</div>
				<div>
					<h2>Blinca</h2>
					<a href={infoUrl('about')}>{t('nav.about')}</a>
					<a href={infoUrl('how')}>{t('nav.how')}</a>
				</div>
				<div>
					<h2>{t('footer.work')}</h2>
					<a href="https://partner.blinca.se/apply">{t('home3.partnerCta')}</a>
					<a href={infoUrl('contact')}>{t('home3.riderTitle')}</a>
				</div>
				<div>
					<h2>{t('footer.help')}</h2>
					<a href={infoUrl('help')}>{t('footer.helpCentre')}</a>
					<a href={infoUrl('contact')}>{t('nav.contact')}</a>
					<a href={infoUrl('terms')}>{t('footer.terms')}</a>
					<a href={infoUrl('privacy')}>{t('footer.privacy')}</a>
				</div>
			</div>
			<div class="ftr-bottom">
				<span>© {year} Blinca AB</span>
				<span
					><button onclick={() => setLang('sv')}>Svenska</button> /
					<button onclick={() => setLang('en')}>English</button></span
				>
			</div>
		</div>
	</footer>
{/if}
