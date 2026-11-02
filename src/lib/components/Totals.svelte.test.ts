/* Totals: "…" only when the cart was never priced; the previous totals stay (faded)
   while a fresh preview loads; fresh totals are not faded. */
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Totals from './Totals.svelte';

const pr = (over: Record<string, unknown> = {}) => ({
	sub: 129, fee: 39, discount: 0, total: 168, vat: 7.3, promo: null, mode: 'delivery', ...over
});

describe('Totals', () => {
	test('fresh: real numbers, not faded', async () => {
		render(Totals, { pr: pr() });
		await expect.element(page.getByText('168 kr')).toBeVisible();
		await expect.element(page.getByText('Including 7,30 kr VAT').or(page.getByText('Varav moms 7,30 kr'))).toBeVisible();
		expect(document.querySelectorAll('.pr-stale')).toHaveLength(0);
	});

	test('stale: the last numbers stay, faded', async () => {
		render(Totals, { pr: pr({ stale: true }) });
		await expect.element(page.getByText('168 kr')).toBeVisible();
		expect(document.querySelectorAll('.sum-row.pr-stale, .sum-total.pr-stale')).toHaveLength(3);
		expect(document.querySelector('.vat.pr-stale')).not.toBeNull();
	});

	test('never priced: "…" instead of numbers, no VAT line', async () => {
		render(Totals, { pr: pr({ loading: true, sub: 0, fee: 0, total: 0, vat: 0 }) });
		expect(document.body.textContent).not.toContain('168 kr');
		expect(document.querySelectorAll('.sum-row, .sum-total')).toHaveLength(3);
		expect([...document.querySelectorAll('.sum-row span:last-child, .sum-total span:last-child')].map((e) => e.textContent)).toEqual(['…', '…', '…']);
		expect(document.querySelector('.vat')).toBeNull();
	});
});
