/* Menu-item sizes (backend "variants") shown as one required single-choice option
   group, so the popup, cart and checkout reuse the option-group markup and code. */

/** Reserved group id: a size lives in `opts` under this key, never in optionIds. */
export const VARIANT_GROUP = '__variant';

/** The "Size" group for an item's backend variants, or null when it has none.
 *  Tile prices are absolute (the item's price becomes the cheapest size).
 *  @param {any[]|undefined} variants @returns {import('#lib/types.js').OptionGroup|null} */
export function variantGroup(variants) {
	if (!variants || !variants.length) return null;
	return {
		id: VARIANT_GROUP,
		name: { en: 'Size', sv: 'Storlek' },
		min: 1,
		max: 1,
		variant: true,
		choices: variants.map((v) => ({
			id: String(v._id),
			name: { en: v.nameEn || v.name, sv: v.name },
			price: (v.priceCents ?? 0) / 100
		}))
	};
}

/** Cheapest size price in kronor (the item's "from" price), or null without sizes.
 *  @param {any[]|undefined} variants @returns {number|null} */
export function fromPrice(variants) {
	if (!variants || !variants.length) return null;
	return Math.min(...variants.map((v) => (v.priceCents ?? 0) / 100));
}

/** Split an opts record into the backend's variantId and flat optionIds.
 *  @param {Record<string, string[]>} [opts] @returns {{ variantId: string|undefined, optionIds: string[] }} */
export function splitOpts(opts) {
	/** @type {string[]} */
	const optionIds = [];
	for (const k of Object.keys(opts || {})) {
		if (k === VARIANT_GROUP) continue;
		for (const id of (opts || {})[k] || []) optionIds.push(id);
	}
	return { variantId: opts?.[VARIANT_GROUP]?.[0], optionIds };
}
