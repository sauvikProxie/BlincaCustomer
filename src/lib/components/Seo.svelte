<script lang="ts">
	import { absolute, site, isProduction } from '#lib/site.js';
	import { serializeJsonLd, type JsonLdNode } from '#lib/seo/jsonld.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';

	/**
	 * Per-page head: title, description, canonical, robots, Open Graph, Twitter,
	 * hreflang and JSON-LD. Icons, manifest and theme-color are global (app.html).
	 * Non-production origins are always noindex (see isProduction).
	 */
	let {
		title,
		description,
		path,
		image,
		type = 'website',
		noindex = false,
		jsonLd = []
	}: {
		title: string;
		description: string;
		path: string;
		image?: string | null;
		type?: 'website' | 'restaurant.restaurant';
		noindex?: boolean;
		jsonLd?: JsonLdNode[];
	} = $props();

	const url = $derived(absolute(path));
	const hidden = $derived(noindex || !isProduction());
	const og = $derived(image ? absolute(image) : absolute(site.ogImage.path));
	const sv = $derived(getLocale() === 'sv');
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta
		name="robots"
		content={hidden ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'}
	/>
	<link rel="canonical" href={url} />
	<!-- TODO: add <link rel="alternate" hreflang> back once each locale has its own URL.
	     The locale is cookie-based today, so every alternate would point at this canonical. -->
	<meta property="og:site_name" content={site.name} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:locale" content={sv ? 'sv_SE' : 'en_GB'} />
	<meta property="og:locale:alternate" content={sv ? 'en_GB' : 'sv_SE'} />
	<meta property="og:image" content={og} />
	{#if !image}
		<meta property="og:image:width" content={String(site.ogImage.width)} />
		<meta property="og:image:height" content={String(site.ogImage.height)} />
	{/if}
	<meta property="og:image:alt" content={image ? title : m.seo_og_image_alt()} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={og} />
	{#each jsonLd as node, i (i)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- serializeJsonLd escapes "<" and line separators -->
		{@html `<script type="application/ld+json">${serializeJsonLd(node)}</script>`}
	{/each}
</svelte:head>
