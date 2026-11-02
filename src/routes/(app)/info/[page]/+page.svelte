<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { toast } from '#lib/layers.svelte.js';
	import { infoUrl } from '#lib/format.js';
	import Seo from '#lib/components/Seo.svelte';
	import { webPage } from '#lib/seo/jsonld.js';
	import { m } from '#lib/paraglide/messages.js';

	/** @type {{ data: { page: string } }} */
	let { data } = $props();

	const page = $derived(data.page);

	/** @type {Record<string, any>} */
	const C = {
		how: {
			en: {
				title: 'How it works',
				body: [
					['Pick a kitchen', 'Browse restaurants near your address, filter by cuisine, delivery time or price, and open any menu.'],
					['Build your order', 'Add dishes, choose sauces and extras, and adjust quantities right from the menu or your cart.'],
					['Check out', 'Choose delivery or pick-up, deliver now or schedule a time, and pay securely.'],
					['Eat', 'Follow your order and get it at your door, usually within 30–40 minutes.']
				]
			},
			sv: {
				title: 'Så funkar det',
				body: [
					['Välj ett kök', 'Hitta restauranger nära din adress, filtrera på kök, leveranstid eller pris och öppna valfri meny.'],
					['Bygg din beställning', 'Lägg till rätter, välj såser och tillbehör och ändra antal direkt i menyn eller varukorgen.'],
					['Gå till kassan', 'Välj leverans eller avhämtning, leverans nu eller vid en vald tid, och betala säkert.'],
					['Ät', 'Följ din beställning och få den till dörren, oftast inom 30–40 minuter.']
				]
			}
		},
		about: {
			en: {
				title: 'About us',
				body: [
					['Local food, fast', 'Blinca connects you with the best independent kitchens in your city – from the pizzeria on the corner to the sushi bar everyone talks about.'],
					['Fair for restaurants', 'We keep fees low and pay restaurants every week, so the places you love can keep doing what they do best.'],
					['Made in Stockholm', 'Blinca started in Stockholm and now delivers in Gothenburg and Malmö too.']
				]
			},
			sv: {
				title: 'Om oss',
				body: [
					['Lokal mat, snabbt', 'Blinca kopplar ihop dig med de bästa fristående köken i din stad – från pizzerian på hörnet till sushibaren alla pratar om.'],
					['Schyst mot restauranger', 'Vi håller avgifterna låga och betalar restaurangerna varje vecka, så att dina favoritställen kan fortsätta göra det de är bäst på.'],
					['Skapat i Stockholm', 'Blinca startade i Stockholm och levererar nu även i Göteborg och Malmö.']
				]
			}
		},
		terms: {
			en: {
				title: 'Terms',
				body: [
					['Orders', 'An order is binding once the restaurant has accepted it. Prices include VAT.'],
					['Delivery', 'Delivery times are estimates. If your order is late or wrong, contact us and we will make it right.'],
					['Refunds', 'Refunds are paid back to the original payment method within 5 working days.']
				]
			},
			sv: {
				title: 'Villkor',
				body: [
					['Beställningar', 'En beställning är bindande när restaurangen har accepterat den. Priserna inkluderar moms.'],
					['Leverans', 'Leveranstider är uppskattningar. Om din beställning är sen eller fel, kontakta oss så löser vi det.'],
					['Återbetalning', 'Återbetalningar görs till det ursprungliga betalsättet inom 5 arbetsdagar.']
				]
			}
		},
		privacy: {
			en: {
				title: 'Privacy',
				body: [
					['What we store', 'Your name, phone number, addresses and order history, so we can deliver your food.'],
					['Who sees it', 'Restaurants and couriers only see what they need to complete your order.'],
					['Your choices', 'You can ask us to export or delete your data at any time: privacy@blinca.se.']
				]
			},
			sv: {
				title: 'Integritet',
				body: [
					['Vad vi sparar', 'Ditt namn, telefonnummer, adresser och orderhistorik, så att vi kan leverera din mat.'],
					['Vem ser det', 'Restauranger och bud ser bara det de behöver för att slutföra din beställning.'],
					['Dina val', 'Du kan när som helst be oss exportera eller radera dina uppgifter: privacy@blinca.se.']
				]
			}
		}
	};

	const FAQ = {
		en: [
			['Where is my order?', 'Open your account to see your latest orders. If the courier is more than 15 minutes late, contact us.'],
			['Can I change my order?', 'You can change your cart until you place the order. After that, contact the restaurant through our support.'],
			['How much does delivery cost?', 'Each restaurant sets its own delivery fee, shown on the restaurant card and at checkout. Some restaurants deliver for free.'],
			['Can I pick up my food myself?', 'Yes. Choose Pick-up at checkout and we will tell you when your food is ready.']
		],
		sv: [
			['Var är min beställning?', 'Öppna ditt konto för att se dina senaste beställningar. Om budet är mer än 15 minuter sent, kontakta oss.'],
			['Kan jag ändra min beställning?', 'Du kan ändra din varukorg tills du lägger beställningen. Därefter kontaktar du restaurangen via vår support.'],
			['Vad kostar leveransen?', 'Varje restaurang sätter sin egen leveransavgift, som visas på restaurangkortet och i kassan. Vissa restauranger levererar gratis.'],
			['Kan jag hämta maten själv?', 'Ja. Välj Avhämtning i kassan så meddelar vi när maten är klar.']
		]
	};

	const content = $derived(C[page]?.[lang()]);
	const title = $derived.by(() => {
		if (content) return content.title;
		if (page === 'contact') return t('nav.contact');
		if (page === 'help') return t('footer.helpCentre');
		return '';
	});

	/** @type {Record<string, () => string>} */
	const DESCRIPTIONS = {
		how: m.seo_desc_how,
		about: m.seo_desc_about,
		help: m.seo_desc_help,
		contact: m.seo_desc_contact,
		terms: m.seo_desc_terms,
		privacy: m.seo_desc_privacy
	};
	const seoDescription = $derived((DESCRIPTIONS[page] ?? m.seo_desc_home)());

	let name = $state('');
	let email = $state('');
	let msg = $state('');
	let err = $state('');
	/** @type {string[]} */
	let bad = $state([]);

	/** @param {SubmitEvent} e */
	function submitContact(e) {
		e.preventDefault();
		const fields = [
			{ id: 'c-name', v: name, email: false },
			{ id: 'c-email', v: email, email: true },
			{ id: 'c-msg', v: msg, email: false }
		];
		bad = fields
			.filter(
				(f) => !f.v.trim() || (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.v.trim()))
			)
			.map((f) => f.id);
		if (bad.length) {
			err = t('form.fix');
			document.getElementById(bad[0])?.focus();
			return;
		}
		err = '';
		bad = [];
		// There is no message backend: hand the message to the customer's own mail
		// client instead of pretending it was sent. Fields stay filled until sent.
		const body = `${msg.trim()}\n\n${name.trim()} <${email.trim()}>`;
		window.location.href = `mailto:hej@blinca.se?subject=${encodeURIComponent(
			`${t('nav.contact')} – ${name.trim()}`
		)}&body=${encodeURIComponent(body)}`;
		toast(m.contact_mailto());
	}
</script>

<Seo
	title="{title} – Blinca"
	description={seoDescription}
	path="/info/{page}"
	jsonLd={[webPage({ title, description: seoDescription, path: `/info/${page}` })]}
/>

<div class="wrap info-wrap">
	{#if content}
		<h1 class="h1">{content.title}</h1>
		<div class="info-grid">
			{#each content.body as b (b[0])}
				<section class="card info-card"><h2 class="h3">{b[0]}</h2><p>{b[1]}</p></section>
			{/each}
		</div>
	{:else if page === 'contact'}
		<h1 class="h1">{t('nav.contact')}</h1>
		<div class="info-grid">
			<section class="card info-card">
				<h2 class="h3">{t('contact.reach')}</h2>
				<p>hej@blinca.se<br />+46 8 123 456 00</p>
				<p class="muted">{t('contact.hours')}</p>
			</section>
			<form class="card info-card" novalidate onsubmit={submitContact}>
				<h2 class="h3">{t('contact.send')}</h2>
				<label class="label mt-12" for="c-name">{t('contact.name')}</label>
				<input
					class="field"
					class:is-invalid={bad.includes('c-name')}
					aria-invalid={bad.includes('c-name') || undefined}
					aria-describedby={bad.includes('c-name') ? 'c-err' : undefined}
					id="c-name"
					required
					autocomplete="name"
					bind:value={name}
				/>
				<label class="label mt-12" for="c-email">{t('contact.email')}</label>
				<input
					class="field"
					class:is-invalid={bad.includes('c-email')}
					aria-invalid={bad.includes('c-email') || undefined}
					aria-describedby={bad.includes('c-email') ? 'c-err' : undefined}
					id="c-email"
					type="email"
					required
					autocomplete="email"
					bind:value={email}
				/>
				<label class="label mt-12" for="c-msg">{t('contact.message')}</label>
				<textarea
					class="field field-area"
					class:is-invalid={bad.includes('c-msg')}
					aria-invalid={bad.includes('c-msg') || undefined}
					aria-describedby={bad.includes('c-msg') ? 'c-err' : undefined}
					id="c-msg"
					rows="4"
					required
					bind:value={msg}
				></textarea>
				{#if err}<p class="form-err" id="c-err" role="alert">{err}</p>{/if}
				<button class="btn btn-primary btn-lg btn-block mt-16">{t('contact.submit')}</button>
			</form>
		</div>
	{:else if page === 'help'}
		<h1 class="h1">{t('footer.helpCentre')}</h1>
		<div class="faq">
			{#each FAQ[lang()] as f, i (f[0])}
				<details class="card faq-item" open={i === 0}>
					<summary>{f[0]}<Icon name="down" size={20} /></summary>
					<p>{f[1]}</p>
				</details>
				{/each}
			</div>
			<p class="muted mt-16">
				{t('help.more')}
				<a class="btn-link" href={infoUrl('contact')}>{t('nav.contact')}</a>
			</p>
		{/if}
	</div>
