<script>
	import { browser } from '#app/env';
	import { page } from '#app/state';
	import { goto } from '#app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { user, setUser } from '#lib/stores/user.svelte.js';
	import { isDesignCheck, sessionCache } from '#lib/stores/session.svelte.js';
	import { toast, toastError } from '#lib/layers.svelte.js';
	import { infoUrl } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { safeNext, withHash } from '#lib/safeNext.js';
	import { saveLocale } from '#lib/stores/saveLocale.js';

	const qp = $derived(browser ? page.url.searchParams : new URLSearchParams());
	/** @type {string|null} */
	let localMode = $state(null);
	const mode = $derived(localMode ?? (qp.get('mode') === 'signup' ? 'signup' : 'login'));
	let next = $derived(safeNext(qp.get('next')));

	let name = $state('');
	let email = $state('');
	let pass = $state('');
	let showPass = $state(false);
	let err = $state('');
	/** @type {string[]} */
	let bad = $state([]);
	let busy = $state(false);
	let forgotBusy = $state(false);

	const signup = $derived(mode === 'signup');

	const legalParts = $derived.by(() => {
		const rx = new RegExp('(\\{terms\\}|\\{privacy\\})');
		return t('login.legal', {}).split(rx);
	});

	/** Same rule as the backend's NAME_REGEX (packages/backend/convex/lib/validation.ts):
	 *  starts with a letter, then letters, spaces, hyphens or apostrophes, max 100. */
	const NAME_REGEX = /^[\p{L}][\p{L}\s'-]{0,99}$/u;

	/** Localised message for a Better Auth error; never the raw (English) server text. */
	function authMessage(/** @type {{ status?: number, code?: string } | null} */ error) {
		if (error?.status === 429) return m.login_error_too_many_attempts();
		if (error?.code === 'INVALID_EMAIL_OR_PASSWORD' || error?.status === 401)
			return m.login_error_invalid_credentials();
		if (error?.code === 'INVALID_NAME') return m.login_error_name_invalid();
		if (error?.code?.startsWith('USER_ALREADY_EXISTS')) return m.login_error_email_taken();
		return m.login_error_generic();
	}

	/** The field a Better Auth error is about, so the right input is marked. */
	function authField(/** @type {{ code?: string } | null} */ error) {
		return error?.code === 'INVALID_NAME' ? 'l-name' : 'l-email';
	}

	function showErr(/** @type {string[]} */ fields, /** @type {string} */ msg) {
		bad = fields;
		err = msg;
		if (fields[0]) document.getElementById(fields[0])?.focus();
	}

	function toggleEye() {
		showPass = !showPass;
	}

	async function forgot() {
		if (forgotBusy) return;
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			showErr(['l-email'], t('login.forgotNeedEmail'));
			return;
		}
		// Design-check has no backend: keep the source's local toast.
		const client = sessionCache.authClient;
		if (isDesignCheck() || !client) {
			toast(t('login.resetSent'));
			return;
		}
		forgotBusy = true;
		/** @type {{ status?: number } | null} */
		let error = null;
		try {
			({ error } = await client.requestPasswordReset({
				email: email.trim(),
				redirectTo: `${window.location.origin}/reset-password`
			}));
		} catch {
			error = {};
		} finally {
			forgotBusy = false;
		}
		// Same message whether or not the email has an account; only throttling
		// and transport failures are distinguishable (they say nothing about it).
		if (error) toastError(error.status === 429 ? m.forgot_rate_limited() : m.forgot_failed());
		else toast(m.forgot_sent());
	}

	function switchMode() {
		const nextMode = signup ? 'login' : 'signup';
		localMode = nextMode;
		const url = new URL(window.location.href);
		url.searchParams.set('mode', nextMode);
		window.history.replaceState(null, '', url);
		name = email = pass = '';
		bad = [];
		err = '';
	}

	/** @param {SubmitEvent} e */
	async function submit(e) {
		e.preventDefault();
		/** @type {string[]} */
		const b = [];
		if (signup && !name.trim()) b.push('l-name');
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) b.push('l-email');
		if (pass.length < 6) b.push('l-pass');
		if (b.length) {
			showErr(b, b.includes('l-pass') && b.length === 1 ? t('login.passShort') : t('form.fix'));
			return;
		}
		if (signup && !NAME_REGEX.test(name.trim())) {
			showErr(['l-name'], m.login_error_name_invalid());
			return;
		}
		showErr([], '');
		// Design-check: fake local login verbatim (pixel-identical, no backend).
		if (isDesignCheck()) {
			busy = true;
			setTimeout(() => {
				const prev = user();
				setUser({
					name: signup
						? name.trim()
						: prev && prev.email === email.trim() && prev.name
							? prev.name
							: email
									.trim()
									.split('@')[0]
									.replace(/^./, (/** @type {string} */ c) => c.toUpperCase()),
					email: email.trim(),
					phone: (prev && prev.phone) || ''
				});
				window.location.href = next;
			}, 500);
			return;
		}
		// Real mode: Better Auth (keeps markup identical).
		const client = sessionCache.authClient;
		if (!client) {
			showErr(['l-email'], t('form.fix'));
			return;
		}
		busy = true;
		try {
			if (signup) {
				const { error } = await client.signUp.email({
					name: name.trim(),
					email: email.trim(),
					password: pass
				});
				if (error) {
					showErr([authField(error)], authMessage(error));
					return;
				}
			} else {
				const { error } = await client.signIn.email({ email: email.trim(), password: pass });
				if (error) throw new Error(authMessage(error));
				// Fallback: a session of another type is dropped silently and looks like bad credentials.
				const { data: fresh } = await client.getSession();
				const freshType = /** @type {{ accountType?: string } | undefined} */ (fresh?.user)
					?.accountType;
				if (freshType !== 'customer') {
					await client.signOut();
					throw new Error(m.login_error_invalid_credentials());
				}
			}
			// Nudge the session store so the layout subscription picks up the new
			// session before we navigate (avoids a logged-out flash on `next`).
			try {
				client.$store?.notify?.('$sessionSignal');
			} catch {}
			// Signed-out language changes are saved now, once per login or sign-up.
			await saveLocale(lang(), { force: true });
			await goto(withHash(next, window.location.hash));
		} catch (e) {
			showErr(['l-email'], e instanceof Error ? e.message : t('form.fix'));
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{signup ? t('login.createTitle') : t('login.title')} – Blinca</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="center-card">
	<div class="card auth-card">
		<div class="auth-logo">
			<img class="logo-svg" src="/img/logo.svg" alt="blinca" width="160" height="50" />
		</div>
		<h1 class="h2">{signup ? t('login.createTitle') : t('login.welcome')}</h1>
		<p class="muted">{signup ? t('login.createSub') : t('login.sub')}</p>
		<form class="auth-form" novalidate onsubmit={submit}>
			{#if signup}
				<div>
					<label class="label" for="l-name">{t('contact.name')}</label>
					<input
						class="field"
						class:is-invalid={bad.includes('l-name')}
						aria-invalid={bad.includes('l-name') || undefined}
						aria-describedby={bad.includes('l-name') ? 'l-err' : undefined}
						id="l-name"
						autocomplete="name"
						required
						bind:value={name}
					/>
				</div>
			{/if}
			<div>
				<label class="label" for="l-email">{t('contact.email')}</label>
				<!-- svelte-ignore a11y_autofocus (dialog/form: focus moves on open, as intended) -->
				<input
					class="field"
					class:is-invalid={bad.includes('l-email')}
						aria-invalid={bad.includes('l-email') || undefined}
						aria-describedby={bad.includes('l-email') ? 'l-err' : undefined}
					id="l-email"
					type="email"
					autocomplete="email"
					required
					autofocus={!signup}
					bind:value={email}
				/>
			</div>
			<div>
				<div class="label-row">
					<label class="label" for="l-pass">{t('login.password')}</label>
					{#if !signup}<button type="button" class="btn-link sm" disabled={forgotBusy} onclick={forgot}
							>{t('login.forgot')}</button
						>{/if}
				</div>
				<div class="pass-wrap">
					<input
						class="field"
						class:is-invalid={bad.includes('l-pass')}
						aria-invalid={bad.includes('l-pass') || undefined}
						aria-describedby={bad.includes('l-pass') ? 'l-err' : undefined}
						id="l-pass"
						type={showPass ? 'text' : 'password'}
						autocomplete={signup ? 'new-password' : 'current-password'}
						required
						minlength="6"
						bind:value={pass}
					/>
					<button
						type="button"
						class="pass-toggle"
						onclick={toggleEye}
						aria-label={showPass ? t('login.hide') : t('login.show')}
						aria-pressed={showPass}><Icon name={showPass ? 'eyeOff' : 'eye'} size={18} /></button
					>
				</div>
				{#if signup}<p class="help">{t('login.passHelp')}</p>{/if}
			</div>
			{#if err}<p class="form-err" id="l-err" role="alert">{err}</p>{/if}
			<button class="btn btn-primary btn-lg btn-block" disabled={busy}>
				{busy ? t('login.wait') : signup ? t('login.create') : t('acct.login')}
			</button>
			<div class="or">{t('login.or')}</div>
			<button type="button" class="btn btn-secondary btn-lg btn-block" onclick={switchMode}>
				{signup ? t('login.haveAccount') : t('login.createTitle')}
			</button>
		</form>
		<p class="legal">
			{#each legalParts as part, i (i)}
				{#if part === '{terms}'}<a class="btn-link sm" href={infoUrl('terms')}>{t('footer.terms')}</a
					>{:else if part === '{privacy}'}<a class="btn-link sm" href={infoUrl('privacy')}
						>{t('footer.privacy')}</a
					>{:else}{part}{/if}
			{/each}
		</p>
	</div>
</div>
