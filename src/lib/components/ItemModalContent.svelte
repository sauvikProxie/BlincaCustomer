<script>
	import Icon from '#lib/components/Icon.svelte';
	import Img from '#lib/components/Img.svelte';
	import Stepper from '#lib/components/Stepper.svelte';
	import { t, lang } from '#lib/stores/language.svelte.js';
	import { item, restaurant, unitPrice } from '#lib/stores/catalog.svelte.js';
	import { L, kr, dishPrice } from '#lib/format.js';
	import { addToCart } from '#lib/ui.js';
	import { itemUnavailable } from '#lib/itemAvailability.js';

	/** @type {{ slug: string, itemId: string, close: () => void }} */
	let { slug, itemId, close } = $props();

	const it = $derived(item(slug, itemId));
	const rest = $derived(restaurant(slug));
	/** @type {Record<string, string[]>} */
	let sel = $state({});
	let qty = $state(1);
	let note = $state('');

	$effect(() => {
		/** @type {Record<string, string[]>} */
		const fresh = {};
		(it?.options || []).forEach((g) => (fresh[g.id] = []));
		sel = fresh;
	});

	const rank = $derived.by(() => {
		if (!rest) return 0;
		const i = (rest.popular || []).indexOf(itemId);
		return i === -1 ? 0 : i + 1;
	});
	const valid = $derived(
		(it?.options || []).every((g) => sel[g.id]?.length >= g.min && sel[g.id]?.length <= g.max)
	);
	const unit = $derived(unitPrice(slug, itemId, sel));
	const unavailable = $derived(it ? itemUnavailable(it.availability, lang()) : '');
	const allergenText = $derived.by(() => {
		if (!it) return '';
		if (!Array.isArray(it.allergens)) return t('allergen.unknown');
		if (it.allergens.length === 0) return t('allergen.none');
		return t('allergen.contains', {
			list: it.allergens.map((/** @type {string} */ a) => t('allergen.' + a)).join(', ')
		});
	});

	/** @param {string} gid @param {string} value @param {boolean} checked @param {boolean} single */
	function onPick(gid, value, checked, single) {
		if (single) sel[gid] = checked ? [value] : [];
		else {
			const cur = new Set(sel[gid] || []);
			if (checked) cur.add(value);
			else cur.delete(value);
			sel[gid] = [...cur];
		}
	}

	function add() {
		if (!valid || unavailable) return;
		close();
		addToCart(slug, itemId, JSON.parse(JSON.stringify(sel)), qty, note);
	}
</script>

{#if it}
	<div class="item-modal">
		<div class="im-media">
			<Img src={it.image} alt={L(it.name, lang())} />
			<button class="icon-btn sm white im-close" data-close aria-label={t('common.close')}
				><Icon name="x" size={18} /></button
			>
		</div>
		<div class="im-main">
			<div class="im-scroll">
				<h2>{L(it.name, lang())}</h2>
				<p class="muted">{L(it.desc, lang())}</p>
				<div class="im-meta">
					<b>{dishPrice(it)}</b>
					{#if (it.tags || []).includes('vegetarian')}
						<span class="tag veg"><Icon name="leaf" size={13} />{t('tag.vegetarian')}</span>
					{/if}
					{#if (it.tags || []).includes('spicy')}
						<span class="tag hot"><Icon name="flame" size={13} />{t('tag.spicy')}</span>
					{/if}
					{#if rank}<span class="tag">{t('rest.mostOrdered', { n: rank })}</span>{/if}
				</div>
				<p class="allergens muted" class:allergens-unknown={!Array.isArray(it.allergens)}>
					<b>{t('allergen.title')}</b> · {allergenText}
				</p>
				{#if unavailable}
					<p class="muted" role="status" data-testid="item-unavailable">{unavailable}</p>
				{/if}
				{#each it.options || [] as g (g.id)}
					{@const n = (sel[g.id] || []).length}
					{@const full = g.max > 1 && n >= g.max}
					<fieldset class="og">
						<div class="og-head">
							<legend>{L(g.name, lang())}</legend>
							<span class="tag" class:hot={g.min > 0 && !n}>
								{g.min > 0
									? t('item.required', { n: g.max }) + (n ? ' · ✓' : '')
									: t('item.upTo', { max: g.max, n })}
							</span>
						</div>
						{#each g.choices as c (c.id)}
							{@const checked = (sel[g.id] || []).includes(c.id)}
							<label class="opt" class:is-on={checked} class:is-dis={full && !checked}>
								<input
									type={g.max === 1 ? 'radio' : 'checkbox'}
									name={'g-' + g.id}
									value={c.id}
									{checked}
									disabled={full && !checked}
									onchange={(e) =>
										onPick(g.id, c.id, e.currentTarget.checked, g.max === 1)}
								/>
								<span class="box" class:round={g.max === 1}><Icon name="check" size={13} /></span>
								<span class="opt-name">{L(c.name, lang())}</span>
								<span class="opt-price">{g.variant ? kr(c.price) : c.price ? '+' + kr(c.price) : ''}</span>
							</label>
						{/each}
					</fieldset>
				{/each}
				<label class="og-title-row" for="im-note"
					><span class="h3">{t('item.note')}</span><span class="count"
						>{t('common.optional')}</span
					></label
				>
				<textarea
					class="field field-area"
					id="im-note"
					rows="2"
					maxlength="140"
					placeholder={t('item.notePh')}
					bind:value={note}
				></textarea>
			</div>
			<div class="im-foot">
				<Stepper
					{qty}
					decLabel={t('qty.less', { name: L(it.name, lang()) })}
					incLabel={t('qty.more', { name: L(it.name, lang()) })}
					size="md"
					decDisabled={qty <= 1}
					disabledInc={qty >= 20}
					onDec={() => (qty = Math.max(1, Math.min(20, qty - 1)))}
					onInc={() => (qty = Math.max(1, Math.min(20, qty + 1)))}
				/>
				<button class="btn btn-primary btn-lg grow" disabled={!valid || !!unavailable} onclick={add}>
					{unavailable
						? unavailable
						: valid
						? t('item.addPrice', { price: kr(unit * qty) })
						: t('item.choose')}
				</button>
			</div>
		</div>
	</div>
{/if}
