/* Money: integer öre in, Swedish text out, the same in every mode and language.
   Whole kronor read "129 kr", anything else "62,78 kr"; `fixed` always shows
   two decimals ("129,00 kr") and is only for receipts (partner/admin format). */

/** @param {number} cents @param {{ fixed?: boolean }} [opts] @returns {string} */
export function formatMoney(cents, opts = {}) {
	const c = Math.round(Number(cents) || 0);
	const whole = c % 100 === 0 && !opts.fixed;
	// ASCII "-": Intl's sv-SE minus is U+2212, which receipts and CSVs avoid.
	const amount = new Intl.NumberFormat('sv-SE', {
		useGrouping: true,
		minimumFractionDigits: whole ? 0 : 2,
		maximumFractionDigits: whole ? 0 : 2
	}).format(Math.abs(c) / 100);
	return `${c < 0 ? '-' : ''}${amount} kr`;
}

/** Kronor (a catalogue/cart price held as a float) → öre, rounded once.
 *  @param {number} kronor */
export const toCents = (kronor) => Math.round((Number(kronor) || 0) * 100);

/** "12,50": two decimals, no unit (for text that already says "kr"). @param {number} cents */
export function formatAmount(cents) {
	return formatMoney(cents, { fixed: true }).replace(/\s*kr$/, '');
}
