<script>
	import Img from '#lib/components/Img.svelte';
	import { L } from '#lib/format.js';
	import { lang } from '#lib/stores/language.svelte.js';

	/** @type {{ offer: any }} */
	let { offer } = $props();
</script>

<span class="offer-text"
	><strong>{L(offer.title, lang())}</strong><span>{L(offer.text, lang())}</span></span
>
<span class="offer-img"><Img src={offer.image} />{#if offer.code}<span class="code">{offer.code}</span>{/if}</span>
