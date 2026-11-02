<script>
	import { toastState } from '#lib/layers.svelte.js';
	import Icon from '#lib/components/Icon.svelte';

	let visible = $state(false);
	let timer = 0;

	$effect(() => {
		if (!toastState.seq) return;
		visible = true;
		clearTimeout(timer);
		timer = window.setTimeout(() => (visible = false), toastState.action || toastState.tone === 'error' ? 6000 : 2400);
	});

	function runAction() {
		const a = toastState.action;
		visible = false;
		a?.onClick();
	}
</script>

<div
	class="toast"
	class:show={visible}
	class:has-action={!!toastState.action}
	class:is-error={toastState.tone === 'error'}
	role={toastState.tone === 'error' ? 'alert' : 'status'}
	aria-live={toastState.tone === 'error' ? 'assertive' : 'polite'}
>
	<Icon name={toastState.tone === 'error' ? 'info' : 'check'} size={18} /><span>{toastState.msg}</span>
	{#if toastState.action}
		<button class="toast-action" onclick={runAction}>{toastState.action.label}</button>
	{/if}
</div>

<style>
	.toast.has-action {
		pointer-events: auto;
	}
	.toast-action {
		margin-left: 10px;
		font-size: 14px;
		font-weight: 700;
		color: #fff;
		text-decoration: underline;
		text-underline-offset: 3px;
		flex: none;
	}
	.toast-action:hover {
		opacity: 0.85;
	}
</style>
