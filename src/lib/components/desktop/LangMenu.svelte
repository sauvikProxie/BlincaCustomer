<script>
	import Icon from '#lib/components/Icon.svelte';
	import { t, lang, setLang } from '#lib/stores/language.svelte.js';

	let open = $state(false);
	/** @type {HTMLElement|null} */
	let wrap = $state(null);
	/** @type {HTMLButtonElement|null} */
	let btn = $state(null);
	/** @type {HTMLButtonElement[]} */
	let rows = $state([]);

	const langs = /** @type {const} */ (['en', 'sv']);
	/** @param {string} x */
	const label = (x) => (x === 'en' ? 'English' : 'Svenska');

	function close(focusBtn = false) {
		open = false;
		if (focusBtn) btn?.focus();
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

	/** @param {KeyboardEvent} e @param {number} i */
	function onRowKey(e, i) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			rows[(i + 1) % rows.length]?.focus();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			rows[(i - 1 + rows.length) % rows.length]?.focus();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			close(true);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (Escape bubbles from the trigger and the menu rows) -->
<div
	class="lm"
	bind:this={wrap}
	onkeydown={(e) => {
		if (e.key === 'Escape' && open) close(true);
	}}
>
	<button
		bind:this={btn}
		class="lm-btn"
		class:open
		onclick={() => (open = !open)}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="{lang().toUpperCase()} {t('header.language')}"
	>
		<Icon name="globe" size={18} />
		<span class="code">{lang().toUpperCase()}</span>
		<Icon name="down" size={14} cls="chev" />
	</button>

	{#if open}
		<div class="lm-menu" role="menu" aria-label={t('header.language')}>
			{#each langs as x, i (x)}
				<button
					bind:this={rows[i]}
					role="menuitemradio"
					aria-checked={lang() === x}
					class="lm-row"
					class:sel={lang() === x}
					onclick={() => {
						setLang(x);
						close(true);
					}}
					onkeydown={(e) => onRowKey(e, i)}
				>
					<span class="badge" class:on={lang() === x}>{x.toUpperCase()}</span>
					<span class="name">{label(x)}</span>
					{#if lang() === x}<Icon name="check" size={16} cls="tick" />{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.lm {
		position: relative;
		flex: none;
	}
	.lm-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 44px;
		padding: 0 12px;
		border-radius: 14px;
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		transition: background-color 0.15s;
	}
	.lm-btn:hover {
		background: var(--bg);
	}
	.lm-btn.open {
		background: var(--field);
	}
	.lm-btn :global(.chev) {
		color: var(--muted);
	}
	.lm-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 10px);
		z-index: 80;
		width: 210px;
		padding: 8px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: 0 16px 40px rgba(60, 20, 20, 0.16);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lm-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 44px;
		padding: 8px 10px;
		border-radius: 12px;
		font-size: 14.5px;
		font-weight: 600;
		color: var(--text);
		text-align: left;
	}
	.lm-row:hover,
	.lm-row:focus-visible {
		background: var(--bg);
	}
	.badge {
		display: grid;
		place-items: center;
		width: 30px;
		height: 24px;
		border-radius: 7px;
		background: var(--soft);
		color: var(--text-2);
		font-size: 11.5px;
		font-weight: 700;
		flex: none;
	}
	.badge.on {
		background: var(--pink);
		color: var(--brand-dark);
	}
	.name {
		flex: 1;
	}
	.lm-row :global(.tick) {
		color: var(--brand);
		flex: none;
	}
</style>
