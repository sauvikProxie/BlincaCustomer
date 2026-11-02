<script>
	import Icon from '#lib/components/Icon.svelte';

	/** Quantity stepper. */
	/** @type {{ qty: number, decLabel: string, incLabel: string, size?: string, disabledInc?: boolean, decDisabled?: boolean, onDec: () => void, onInc: () => void }} */
	let { qty, decLabel, incLabel, size = '', disabledInc = false, decDisabled = false, onDec, onInc } = $props();
</script>

<div class="stepper {size}">
	<button onclick={onDec} aria-label={decLabel} disabled={decDisabled}><Icon name="minus" size={16} /></button>
	<b aria-live="polite">{qty}</b>
	<button onclick={onInc} aria-label={incLabel} disabled={disabledInc}><Icon name="plus" size={16} /></button>
</div>
