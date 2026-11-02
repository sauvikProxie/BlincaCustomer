<script>
	import { page } from '#app/state';
	import { sessionCache } from '#lib/stores/session.svelte.js';
	import { m } from '#lib/paraglide/messages.js';

	// Better Auth redirects here with ?token=… (valid) or ?error=INVALID_TOKEN.
	const token = $derived(page.url.searchParams.get('token') ?? '');
	const invalid = $derived(!token || page.url.searchParams.has('error'));

	let pass = $state('');
	let again = $state('');
	let err = $state('');
	let busy = $state(false);
	let done = $state(false);

	/** @param {SubmitEvent} e */
	async function submit(e) {
		e.preventDefault();
		err = '';
		if (pass.length < 8) return void (err = m.reset_hint());
		if (pass !== again) return void (err = m.reset_mismatch());
		const client = sessionCache.authClient;
		if (!client) return void (err = m.reset_failed());
		busy = true;
		const { error } = await client.resetPassword({ newPassword: pass, token });
		busy = false;
		if (error) err = error.code === 'INVALID_TOKEN' ? m.reset_invalid() : m.reset_failed();
		else done = true;
	}
</script>

<svelte:head
	><title>{m.reset_title()} – Blinca</title><meta
		name="robots"
		content="noindex,nofollow"
	/></svelte:head
>

<div class="center-card">
	<div class="card auth-card">
		<div class="auth-logo">
			<img class="logo-svg" src="/img/logo.svg" alt="blinca" width="160" height="50" />
		</div>
		<h1 class="h2">{m.reset_title()}</h1>
		{#if done}
			<p class="muted">{m.reset_done()}</p>
			<a class="btn btn-primary btn-lg btn-block" href="/login">{m.reset_to_login()}</a>
		{:else if invalid}
			<p class="form-err" role="alert">{m.reset_invalid()}</p>
			<a class="btn btn-secondary btn-lg btn-block" href="/login">{m.reset_to_login()}</a>
		{:else}
			<form class="auth-form" novalidate onsubmit={submit}>
				<div>
					<label class="label" for="r-pass">{m.reset_password()}</label>
					<input
						class="field"
						id="r-pass"
						type="password"
						autocomplete="new-password"
						required
						bind:value={pass}
					/>
					<p class="help">{m.reset_hint()}</p>
				</div>
				<div>
					<label class="label" for="r-again">{m.reset_confirm()}</label>
					<input
						class="field"
						id="r-again"
						type="password"
						autocomplete="new-password"
						required
						bind:value={again}
					/>
				</div>
				{#if err}<p class="form-err" id="form-err" role="alert">{err}</p>{/if}
				<button class="btn btn-primary btn-lg btn-block" disabled={busy}>
					{busy ? m.reset_submitting() : m.reset_submit()}
				</button>
			</form>
		{/if}
	</div>
</div>
