/**
 * Display-only line totals for the item modal. Integer öre throughout,
 * VAT-inclusive, mirroring the server rule in
 * `packages/backend/convex/lib/orderBuilder.ts`:
 * `lineTotalCents = (unitPrice + Σ option.price × qty) × qty`, where a
 * chosen variant replaces the base price.
 *
 * `buildLine` itself is NOT in `@blinca/backend`'s package exports, so the
 * client cannot import it without a backend change (out of scope for this
 * step). These numbers are a preview only — Step 5's checkout re-validates
 * and re-prices everything on the server.
 */
export type PricedSelection = {
	basePriceCents: number;
	variantPriceCents?: number;
	options: { priceCents: number; quantity: number }[];
	quantity: number;
};

export function previewUnitPriceCents(selection: PricedSelection): number {
	const unit = selection.variantPriceCents ?? selection.basePriceCents;
	const options = selection.options.reduce(
		(sum, option) => sum + option.priceCents * option.quantity,
		0
	);
	return unit + options;
}

export function previewLineTotalCents(selection: PricedSelection): number {
	return previewUnitPriceCents(selection) * Math.max(1, Math.floor(selection.quantity));
}
