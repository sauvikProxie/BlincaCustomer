/* The "Rate your order" email links to /orders/{id}#rate. Both the desktop and the
   phone layout are in the DOM (CSS hides one), so pick the visible element. */

/** @param {Element} el */
const visible = (el) => el.getClientRects().length > 0;

/**
 * The visible rating card, else the visible order status block (the order cannot be
 * rated yet), else null.
 * @param {{ querySelectorAll(selector: string): Iterable<Element> }} root
 * @returns {Element | null}
 */
export function rateTarget(root) {
	const pick = (/** @type {string} */ selector) =>
		[...root.querySelectorAll(selector)].find(visible) ?? null;
	return pick('[data-rate-card]') ?? pick('[data-order-status]');
}

/** @param {string} hash location.hash */
export const wantsRate = (hash) => hash === '#rate';
