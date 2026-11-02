<script>
	/** Filter/toggle chip (36px, .chip). */
	/** @type {{ on?: boolean, small?: boolean, pressed?: boolean, expanded?: boolean, label?: string, onclick?: (e: MouseEvent) => void, children: import('svelte').Snippet }} */
	let { on = false, small = false, pressed = undefined, expanded = undefined, label = undefined, onclick, children } = $props();
</script>

<button
	class="chip"
	class:is-on={on}
	class:sm={small}
	aria-pressed={pressed ?? !!on}
	aria-label={label}
	aria-haspopup={expanded == null ? undefined : 'true'}
	aria-expanded={expanded}
	{onclick}
>
	{@render children()}
</button>
