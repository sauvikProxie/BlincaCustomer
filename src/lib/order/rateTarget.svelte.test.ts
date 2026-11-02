import { describe, expect, it } from 'vitest';
import { rateTarget, wantsRate } from './rateTarget.js';

function root(html: string): HTMLElement {
	const el = document.createElement('div');
	el.innerHTML = html;
	document.body.appendChild(el);
	// jsdom-less browser tests: hidden = display:none
	return el;
}

describe('rateTarget', () => {
	it('prefers the visible rating card over the hidden duplicate and the status', () => {
		const r = root(
			'<div data-rate-card id="hidden" style="display:none"></div><div data-rate-card id="shown"></div><div data-order-status id="status"></div>'
		);
		expect(rateTarget(r)?.id).toBe('shown');
		r.remove();
	});
	it('falls back to the order status when nothing can be rated yet', () => {
		const r = root('<div data-order-status id="status"></div>');
		expect(rateTarget(r)?.id).toBe('status');
		r.remove();
	});
	it('returns null when neither exists', () => {
		const r = root('<p></p>');
		expect(rateTarget(r)).toBeNull();
		r.remove();
	});
	it('only #rate asks for it', () => {
		expect(wantsRate('#rate')).toBe(true);
		expect(wantsRate('')).toBe(false);
		expect(wantsRate('#other')).toBe(false);
	});
});
