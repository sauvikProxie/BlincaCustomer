import { describe, expect, it } from 'vitest';
import { restaurantDescription, truncateAtWord } from './description';

const msgs = {
	full: ({ name, cuisines, city }: { name: string; cuisines: string; city: string }) =>
		`Order from ${name} (${cuisines}) in ${city}.`,
	noCity: ({ name, cuisines }: { name: string; cuisines: string }) =>
		`Order from ${name} (${cuisines}).`,
	noCuisine: ({ name, city }: { name: string; city: string }) => `Order from ${name} in ${city}.`,
	bare: ({ name }: { name: string }) => `Order from ${name}.`
};

describe('restaurantDescription', () => {
	it('uses every part when present', () => {
		expect(restaurantDescription({ name: 'Fika', cuisines: 'Café', city: 'Göteborg' }, msgs)).toBe(
			'Order from Fika (Café) in Göteborg.'
		);
	});

	it('never renders an empty "( )" with zero cuisines', () => {
		for (const cuisines of ['', '   ', undefined]) {
			const text = restaurantDescription({ name: 'Fika', cuisines, city: 'Göteborg' }, msgs);
			expect(text).toBe('Order from Fika in Göteborg.');
			expect(text).not.toMatch(/\(\s*\)/);
		}
	});

	it('falls back to the bare message with no cuisines and no city', () => {
		expect(restaurantDescription({ name: 'Fika', cuisines: '', city: '' }, msgs)).toBe(
			'Order from Fika.'
		);
	});

	it('truncates a long description at a word boundary', () => {
		const text = restaurantDescription(
			{ name: 'Restaurang '.repeat(30).trim(), cuisines: 'Café', city: 'Göteborg' },
			msgs
		);
		expect(text.length).toBeLessThanOrEqual(155);
		expect(text.endsWith('…')).toBe(true);
		expect(text.slice(0, -1).endsWith('Restaurang')).toBe(true);
	});
});

describe('truncateAtWord', () => {
	it('leaves short text alone and collapses whitespace', () => {
		expect(truncateAtWord('a  b\n c')).toBe('a b c');
	});

	it('stays within the limit and does not leave a dangling comma', () => {
		const out = truncateAtWord('alpha beta, gamma delta', 12);
		expect(out.length).toBeLessThanOrEqual(12);
		expect(out).toBe('alpha beta…');
	});

	it('hard-cuts a single word longer than the limit', () => {
		const out = truncateAtWord('x'.repeat(200), 20);
		expect(out).toHaveLength(20);
		expect(out.endsWith('…')).toBe(true);
	});
});
