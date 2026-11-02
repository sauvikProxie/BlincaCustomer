import { expect, test, type Page } from '@playwright/test';
import { STORAGE_STATE } from './support/signIn';

// Every spec here only needs to *be* signed in, so they reuse the session
// customer.setup.ts saved rather than signing in again.
test.use({ storageState: STORAGE_STATE });

const SHOT_DIR = 'test-results/dash';

const grid = (page: Page) => page.locator('[data-testid="restaurant-grid"] > li');

async function gotoDashboard(page: Page) {
	await page.goto('/dashboard');
	// The grid only exists once the Convex subscription has delivered data.
	await expect(page.locator('[data-testid="restaurant-grid"]')).toBeVisible();
}

/**
 * Opens the profile menu. The grid check matters: it only renders once the
 * Convex subscription has delivered, which means Svelte has hydrated. Clicking
 * the trigger before then lands on the DOM but hits no handler, so the menu
 * never opens — the cause of a real flake when this spec reloads for a locale
 * switch.
 */
async function openProfileMenu(page: Page, triggerName: string) {
	await expect(page.locator('[data-testid="restaurant-grid"]')).toBeVisible();
	await page.getByRole('button', { name: triggerName }).click();
	await expect(page.getByRole('menu')).toBeVisible();
}

async function chooseTheme(page: Page, choice: 'light' | 'dark') {
	await openProfileMenu(page, 'Profilmeny');
	await page.locator(`[data-theme-choice="${choice}"]`).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', choice);
	await page.keyboard.press('Escape');
}

test('the dashboard greets the customer and lists restaurants', async ({ page }) => {
	await gotoDashboard(page);

	await expect(page.getByRole('heading', { level: 1, name: /^Hej, / })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Restauranger nära dig' })).toBeVisible();
	await expect(grid(page)).toHaveCount(6); // the six seeded Stockholm restaurants

	// Landmarks and heading order. The nav landmark is the mobile tab bar,
	// which is display:none at this width — the viewport specs below cover it.
	await expect(page.locator('header')).toBeVisible();
	await expect(page.locator('main')).toBeVisible();
	await expect(page.locator('footer')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

	// Cards carry the data the brief asks for.
	const first = grid(page).first();
	await expect(first.getByRole('img')).toBeVisible();
	await expect(first).toContainText('min');
	await expect(first.getByRole('link')).toHaveAttribute('href', /^\/restaurant\//);
});

test('the active order card shows the seeded in-progress order', async ({ page }) => {
	await gotoDashboard(page);

	const ticket = page.getByRole('region', { name: 'Pågående beställning' });
	await expect(ticket).toBeVisible();
	await expect(ticket).toContainText('Pizzeria Vesuvio');
	await expect(ticket.getByRole('link', { name: 'Spåra beställning' })).toBeVisible();

	// Status steps, with the live region announcing the current one.
	const steps = page.getByTestId('order-steps');
	await expect(steps).toHaveAttribute('aria-live', 'polite');
	await expect(steps.locator('li')).toHaveCount(5);
	await expect(steps.locator('li[aria-current="step"]')).toHaveText(/Tillagas/);
});

test('a category chip filters the grid', async ({ page }) => {
	await gotoDashboard(page);
	await expect(grid(page)).toHaveCount(6);

	const chips = page.getByTestId('category-chips');
	await chips.locator('[data-chip="pizza"]').click();

	await expect(chips.locator('[data-chip="pizza"]')).toHaveAttribute('aria-pressed', 'true');
	await expect(grid(page)).toHaveCount(1);
	await expect(grid(page).first()).toContainText('Pizzeria Vesuvio');
});

test('a quick filter filters the grid', async ({ page }) => {
	await gotoDashboard(page);

	const filters = page.getByTestId('quick-filters');
	await filters.locator('[data-chip="freeDelivery"]').click();

	await expect(filters.locator('[data-chip="freeDelivery"]')).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	// Only Sushi Sakura and Gröna Greken deliver free in Stockholm.
	await expect(grid(page)).toHaveCount(2);
	await expect(page.getByTestId('restaurant-grid')).toContainText('Sushi Sakura');
});

test('the empty state appears when filters match nothing', async ({ page }) => {
	await gotoDashboard(page);

	// Pizza is the one Stockholm pizzeria and it charges for delivery.
	await page.getByTestId('category-chips').locator('[data-chip="pizza"]').click();
	await page.getByTestId('quick-filters').locator('[data-chip="freeDelivery"]').click();

	await expect(page.getByTestId('restaurant-grid')).toHaveCount(0);
	await expect(page.getByText('Inga restauranger här än')).toBeVisible();

	// The empty state's action clears the filters and brings the grid back.
	await page.getByRole('button', { name: 'Rensa filter' }).click();
	await expect(grid(page)).toHaveCount(6);
});

test('a favourite survives a reload', async ({ page }) => {
	await gotoDashboard(page);

	// Pizzeria Vesuvio is not one of the seeded favourites.
	const card = grid(page).filter({ hasText: 'Pizzeria Vesuvio' });
	const heart = card.getByRole('button', { name: 'Spara som favorit' });
	await expect(heart).toHaveAttribute('aria-pressed', 'false');
	await heart.click();

	const pressed = card.getByRole('button', { name: 'Ta bort från favoriter' });
	await expect(pressed).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('favorites-row')).toContainText('Pizzeria Vesuvio');

	await page.reload();
	await expect(page.locator('[data-testid="restaurant-grid"]')).toBeVisible();
	await expect(
		grid(page)
			.filter({ hasText: 'Pizzeria Vesuvio' })
			.getByRole('button', { name: 'Ta bort från favoriter' })
	).toHaveAttribute('aria-pressed', 'true');

	// Put the seed data back so the spec can run again.
	await grid(page)
		.filter({ hasText: 'Pizzeria Vesuvio' })
		.getByRole('button', { name: 'Ta bort från favoriter' })
		.click();
	await expect(
		grid(page)
			.filter({ hasText: 'Pizzeria Vesuvio' })
			.getByRole('button', { name: 'Spara som favorit' })
	).toBeVisible();
});

test('the language switch in the profile menu swaps the dashboard copy', async ({ page }) => {
	await gotoDashboard(page);
	await expect(page.getByRole('heading', { name: 'Restauranger nära dig' })).toBeVisible();

	await openProfileMenu(page, 'Profilmeny');
	await page.getByRole('button', { name: 'Engelska' }).click();

	await expect(page.getByRole('heading', { level: 1, name: /^Hi, / })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('heading', { name: 'Restaurants near you' })).toBeVisible();

	await openProfileMenu(page, 'Profile menu');
	await page.getByRole('button', { name: 'Swedish' }).click();
	await expect(page.getByRole('heading', { level: 1, name: /^Hej, / })).toBeVisible();
});

test('money and times use Swedish formatting', async ({ page }) => {
	await gotoDashboard(page);

	const ticket = page.getByRole('region', { name: 'Pågående beställning' });
	const text = (await ticket.textContent()) ?? '';

	// "276 kr" — not "276,00 kr" and not "SEK 276". The separator is U+00A0,
	// which \s matches.
	expect(text).toMatch(/\d+\skr/);
	expect(text).not.toMatch(/\d+,\d{2}\skr/);
	expect(text).not.toContain('SEK');
	// 24-hour clock.
	expect(text).toMatch(/Framme ca \d{2}:\d{2}/);
});

for (const [label, width, height] of [
	['mobile', 320, 720],
	['tablet', 768, 1024],
	['desktop', 1280, 900]
] as const) {
	test(`layout holds at ${label} in light and dark`, async ({ page }) => {
		await page.setViewportSize({ width, height });
		await gotoDashboard(page);

		for (const theme of ['light', 'dark'] as const) {
			await chooseTheme(page, theme);
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

			const overflows = await page.evaluate(
				() => document.documentElement.scrollWidth > document.documentElement.clientWidth
			);
			expect(overflows, `${label}/${theme} must not scroll horizontally`).toBe(false);

			await page.screenshot({ path: `${SHOT_DIR}/${label}-${theme}.png`, fullPage: true });
		}

		// The tab bar is the mobile navigation and is gone on desktop.
		const tabbar = page.getByRole('navigation', { name: 'Huvudmeny' });
		if (width < 768) {
			await expect(tabbar).toBeVisible();
		} else {
			await expect(tabbar).toBeHidden();
		}
	});
}

test('a signed-out visitor cannot reach the dashboard', async ({ browser }) => {
	// A context with no stored session.
	const page = await (await browser.newContext({ storageState: undefined })).newPage();
	await page.goto('/dashboard');
	await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
	await page.close();
});
