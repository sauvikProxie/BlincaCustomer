import { expect, test } from '@playwright/test';
import { esc, mutateData, noHScroll, open, seedEmpty, tr } from './support';

test.beforeEach(async ({ page }) => {
	await seedEmpty(page);
});

test('a 100+ dish menu renders without horizontal overflow and chips jump to sections', async ({
	page
}, info) => {
	await mutateData(
		page,
		`(out) => {
			const r = out.restaurants[0];
			for (let c = 0; c < 5; c++) {
				const items = [];
				for (let i = 0; i < 24; i++) {
					items.push({ id: 'bulk-' + c + '-' + i, name: { en: 'Bulk dish ' + c + '-' + i, sv: 'Bulkrätt ' + c + '-' + i },
						desc: { en: 'Filler', sv: 'Fyllnad' }, price: 50 + i, tags: [], options: [], image: null });
				}
				r.menu.push({ id: 'bulk' + c, name: { en: 'Bulk ' + c, sv: 'Bulk ' + c }, items });
			}
		}`
	);
	for (const vp of [
		{ width: 1440, height: 900 },
		{ width: 390, height: 844 }
	]) {
		await page.setViewportSize(vp);
		await open(page, '/restaurants/blinca-demo');
		expect(await page.locator('article.mi').count()).toBeGreaterThanOrEqual(100);
		expect(await noHScroll(page), `${vp.width}px`).toBe(true);
	}
	const chip = page.locator('.cat-chips .chip', { hasText: /^Bulk 4/ });
	await chip.click();
	await expect(page.locator('#item-bulk-4-0')).toBeInViewport();
	await expect(chip).toHaveClass(/is-on/);
	void info;
});

const LONG_WORDS =
	'Den Allra Mest Fantastiska Restaurangen Med Alldeles För Långt Namn Som Aldrig Tar Slut';
const LONG_WORD = 'Överdrivetlånganamnutanmellanslagsomtyvärrförekommer';

for (const [title, name] of [
	['long multi-word', LONG_WORDS + ' ' + LONG_WORDS],
	['long unbroken-word', LONG_WORD]
]) {
	const run = async (page: import('@playwright/test').Page) => {
		await mutateData(
			page,
			`(out) => {
				const L = ${JSON.stringify(name)};
				const r = out.restaurants[0];
				r.name = L;
				r.address = L + ' 1, 111 51 Stockholm';
				r.menu[0].items[0].name = { en: L, sv: L };
				r.menu[0].items[0].desc = { en: L, sv: L };
				out.addresses[0].street = L;
				out.addresses[0].label = L;
			}`
		);
		await page.setViewportSize({ width: 360, height: 780 });
		for (const url of ['/restaurants/blinca-demo', '/checkout', '/']) {
			await open(page, url);
			expect(await noHScroll(page), url).toBe(true);
		}
	};
	test(`${title} restaurant, dish and address names do not overflow at 360px`, async ({ page }) =>
		run(page));
}

for (const [kind, key] of [
	['sold_out_today', 'item_status_sold_out_today'],
	['sold_out_indefinitely', 'item_status_sold_out'],
	['outside_schedule', 'item_status_outside_schedule']
] as const) {
	test(`a ${kind} dish shows a label and cannot be added`, async ({ page }, info) => {
		await mutateData(
			page,
			`(out) => { const it = out.restaurants[0].menu[0].items[0];
				it.soldOut = true; it.availability = { kind: ${JSON.stringify(kind)} }; }`
		);
		await open(page, '/restaurants/blinca-demo');
		const card = page.locator('#item-margherita');
		await expect(card.getByTestId('sold-out')).toHaveText(tr(info, key));
		await expect(
			card.getByRole('button', { name: new RegExp('^' + esc(tr(info, 'qty.add', { name: '' }))) })
		).toBeDisabled();
		// Opening the dish by its name cannot add it either: a toast, no cart line.
		await card.getByRole('heading').getByRole('button').click();
		await expect(page.getByText(tr(info, key)).last()).toBeVisible();
		await expect(page.locator('#item-margherita .stepper')).toHaveCount(0);
	});
}

test('an available dish next to a sold-out one stays orderable', async ({ page }, info) => {
	await mutateData(
		page,
		`(out) => { const it = out.restaurants[0].menu[0].items[0];
			it.soldOut = true; it.availability = { kind: 'sold_out_today' }; }`
	);
	await open(page, '/restaurants/blinca-demo');
	const other = page.locator('article.mi').nth(1);
	await expect(other.getByTestId('sold-out')).toHaveCount(0);
	await expect(
		other.getByRole('button', { name: new RegExp('^' + esc(tr(info, 'qty.add', { name: '' }))) })
	).toBeEnabled();
});
