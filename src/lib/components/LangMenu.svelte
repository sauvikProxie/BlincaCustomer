<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t, lang, setLang } from '#lib/stores/language.svelte.js';

	let open = $state(false);
	/** @type {HTMLElement|null} */
	let wrap = $state(null);

	/** @type {HTMLButtonElement|null} */
	let btn = $state(null);

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		if (e.key === 'Escape' && open) {
			open = false;
			btn?.focus();
		}
	}

	$effect(() => {
		if (!open) return;
		/** @param {MouseEvent} e */
		const onDoc = (e) => {
			if (wrap && e.target instanceof Node && !wrap.contains(e.target)) open = false;
		};
		document.addEventListener('click', onDoc);
		return () => document.removeEventListener('click', onDoc);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (Escape bubbles from the menu's own controls) -->
<div class="pop-wrap lang-wrap" bind:this={wrap} onkeydown={onKey}>
	<button
		bind:this={btn}
		class="lang-pill"
		onclick={() => (open = !open)}
		aria-haspopup="true"
		aria-expanded={open}
		aria-label="{lang().toUpperCase()} {t('header.language')}"
	>
		<Icon name="globe" size={19} />{lang().toUpperCase()}<Icon name="down" size={15} />
	</button>
	<div class="menu lang-menu" role="menu" hidden={!open}>
		{#each ['en', 'sv'] as x}
			<button
				role="menuitemradio"
				aria-checked={lang() === x}
				onclick={() => {
					setLang(x);
					open = false;
				}}
				><span class="lm-code">{x.toUpperCase()}</span>{x === 'en' ? 'English' : 'Svenska'}
				{#if lang() === x}<Icon name="check" size={16} cls="ml-auto brand" />{/if}</button
			>
		{/each}
	</div>
</div>
