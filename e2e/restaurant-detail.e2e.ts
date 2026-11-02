import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Restaurant detail page (/restaurants/[slug]). Runs against the live stack
 * with all three seeds (no sign-in needed — the page is public):
 *
 *   cd packages/backend && bun run dev                       # terminal 1
 *   cd apps/customer && bun run dev                           # terminal 2
 *   cd packages/backend && bun run seed:customer \
 *     && bun run seed:marketplace && bun run seed:dev         # fixtures + menu
 *   CUSTOMER_BASE_URL=http://localhost:5173 \
 *     bunx playwright test e2e/restaurant-detail.e2e.ts --no-deps --project=chromium
 *
 * Fixed seed facts (seed.ts + seedMenu.ts, never the real clock):
 * blinca-demo ("Blinca Demo") is open around the clock and carries the full
 * demo menu — Pizza (Margherita 119 kr vegetarian, Kebabpizza 139 kr),
 * Burgare (Klassisk burgare 149 kr, Halloumiburgare), Dagens lunch (Pasta
 * carbonara 115 kr, Mon–Fri 11–14 only), Dryck (Coca-Cola with 33/50 cl
 * variants, Mineralvatten vegan). Kebabpizza has "Välj dipsås" (min 1, max 1;
 * Vitlökssås/Bearnaise free, Chilimajonnäs 5 kr) and "Extra toppings"
 * (min 0, max 3, repeatable; Extra ost 15 kr, Jalapeños/Champinjoner 10 kr).
 * pizzeria-vesuvio has no hours rows (closed) and no menu; bangkok-street has
 * isAcceptingOrders=false (paused indefinitely) and no menu. Every seeded
 * item is available — sold-out rows are covered by the MenuItemRow browser
 * spec instead, since forcing one needs partner writes.
 */

const DEMO = '/restaurants/blinca-demo';
const VESUVIO = '/restaurants/pizzeria-vesuvio';
const BANGKOK = '/restaurants/bangkok-street';

async function setLocaleCookie(page: Page, locale: 'sv' | 'en') {
	await page.goto('/');
	await page.evaluate((value) => {
		document.cookie = `PARAGLIDE_LOCALE=${value}; path=/`;
	}, locale);
}

test.describe('layout', () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test('desktop: the panel stays pinned while only the page scrolls', async ({ page }) => {
		await page.goto(DEMO);
		const panel = page.getByTestId('restaurant-panel');
		const before = await panel.boundingBox();
		await page.evaluate(() => window.scrollTo(0, 1500));
		const after = await panel.boundingBox();
		expect(before?.y).toBeGreaterThan(0);
		expect(after?.y).toBeCloseTo(before?.y ?? -1, 0);

		// Exactly one vertical scroller: the document itself.
		const scrollers = await page.evaluate(
			() =>
				[...document.querySelectorAll('*')].filter((el) => el.scrollHeight - el.clientHeight > 2)
					.length
		);
		expect(scrollers).toBe(0);
	});

	test('desktop has no horizontal scroll', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto(DEMO);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth
		);
		expect(overflow).toBeLessThanOrEqual(1);
	});
});

test.describe('mobile layout', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the cover stays pinned while the sheet slides over it', async ({ page }) => {
		await page.goto(DEMO);
		const cover = page.getByTestId('restaurant-cover');
		const sheet = page.getByTestId('restaurant-sheet');
		const coverBefore = await cover.boundingBox();
		const sheetBefore = await sheet.boundingBox();
		await page.evaluate(() => window.scrollTo(0, 1500));
		const coverAfter = await cover.boundingBox();
		const sheetAfter = await sheet.boundingBox();
		// Pinned under the 72px sticky header.
		expect(coverBefore?.y).toBeCloseTo(72, 0);
		expect(coverAfter?.y).toBeCloseTo(72, 0);
		// The content moved up over it.
		expect(sheetAfter?.y).toBeLessThan(sheetBefore?.y ?? Number.MAX_SAFE_INTEGER);
		// The name rides on the sheet.
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});
});

test.describe('menu', () => {
	test('category chips jump on click and Enter, and highlight on scroll', async ({ page }) => {
		await page.goto(DEMO);
		const nav = page.getByTestId('category-nav');
		await expect(nav.getByRole('link', { name: 'Dryck' })).toBeVisible();

		await nav.getByRole('link', { name: 'Dryck' }).click();
		expect(page.url()).toMatch(/#menu-cat-.+/);
		await expect(page.getByTestId('menu-category').last()).toBeInViewport();

		await nav.getByRole('link', { name: 'Pizza' }).focus();
		await page.keyboard.press('Enter');
		expect(page.url()).toMatch(/#menu-cat-.+/);

		await page.getByTestId('menu-category').last().scrollIntoViewIfNeeded();
		await expect(nav.getByRole('link', { name: 'Dryck' })).toHaveAttribute('aria-current', 'true');
	});

	test('closed restaurant: banner, inert schedule button, empty menu state', async ({ page }) => {
		await page.goto(VESUVIO);
		await expect(page.getByTestId('status-banner')).toHaveAttribute('data-kind', 'closed');
		// Scheduling lands in Step 6: visible but inert.
		await expect(page.getByTestId('banner-schedule')).toHaveAttribute('aria-disabled', 'true');
		// No menu seeded: friendly empty state, no invented dishes.
		await expect(page.getByTestId('restaurant-page')).toContainText('Menyn är tom just nu');
	});

	test('paused restaurant: banner with the paused reason', async ({ page }) => {
		await page.goto(BANGKOK);
		await expect(page.getByTestId('status-banner')).toHaveAttribute('data-kind', 'paused_long');
		await expect(page.getByTestId('status-banner')).toContainText('Pausat');
	});

	test('quick add on a plain item shows the cart stub toast', async ({ page }) => {
		await page.goto(DEMO);
		const row = page
			.getByRole('button', { name: /Läs mer om Mineralvatten/ })
			.locator('xpath=ancestor::article[1]');
		await row.getByRole('button', { name: 'Lägg till' }).click();
		await expect(page.getByRole('status').last()).toContainText('Varukorgen kommer i nästa steg');
	});
});

test.describe('item modal', () => {
	async function openKebabpizza(page: Page) {
		await page.goto(DEMO);
		await page.getByRole('button', { name: /Läs mer om Kebabpizza/ }).click();
		await expect(page.getByTestId('item-modal')).toBeVisible();
	}

	test('required group blocks Add until chosen; max is enforced; total updates', async ({
		page
	}) => {
		await openKebabpizza(page);
		const add = page.getByTestId('modal-add');
		await expect(add).toHaveAttribute('aria-disabled', 'true');
		await expect(page.getByTestId('modal-total')).toContainText('139 kr');

		// Submit with nothing chosen: the required dip group complains.
		await add.click();
		await expect(page.getByRole('alert').first()).toContainText('Välj minst 1');

		await page.getByRole('radio', { name: /Vitlökssås/ }).check();
		await expect(add).not.toHaveAttribute('aria-disabled');
		await expect(page.getByTestId('modal-total')).toContainText('139 kr');

		// A paid topping moves the total by exactly its price.
		await page.getByRole('checkbox', { name: /Extra ost/ }).check();
		await expect(page.getByTestId('modal-total')).toContainText('154 kr');

		// Fill the group to max, then push one past it with the stepper.
		await page.getByRole('checkbox', { name: /Jalapeños/ }).check();
		await page.getByRole('checkbox', { name: /Champinjoner/ }).check();
		const choice = page
			.getByRole('checkbox', { name: /Extra ost/ })
			.locator('xpath=ancestor::div[contains(@class,"choice")][1]');
		await choice.getByRole('button', { name: 'Öka antal' }).click();
		await expect(page.getByRole('alert').first()).toContainText('Välj högst 3');
		await expect(add).toHaveAttribute('aria-disabled', 'true');
		await expect(page.getByTestId('modal-total')).toContainText('169 kr');
	});

	test('Escape closes, focus returns, the page behind does not scroll', async ({ page }) => {
		await openKebabpizza(page);
		const locked = await page.evaluate(() => document.body.style.overflow);
		expect(locked).toBe('hidden');
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('item-modal')).toBeHidden();
		expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
		const focused = await page.evaluate(
			() => document.activeElement?.getAttribute('aria-label') ?? ''
		);
		expect(focused).toContain('Kebabpizza');
	});

	test('choosing the required option and adding shows the stub toast', async ({ page }) => {
		await openKebabpizza(page);
		await page.getByRole('radio', { name: /Vitlökssås/ }).check();
		await page.getByTestId('modal-add').click();
		await expect(page.getByRole('status').last()).toContainText('Varukorgen kommer i nästa steg');
		await expect(page.getByTestId('item-modal')).toBeHidden();
	});

	test('variants are a required radio group with live pricing', async ({ page }) => {
		await page.goto(DEMO);
		await page.getByRole('button', { name: /Läs mer om Coca-Cola/ }).click();
		await expect(page.getByTestId('item-modal')).toBeVisible();
		// First size preselected: 25 kr.
		await expect(page.getByTestId('modal-total')).toContainText('25 kr');
		await page.getByRole('radio', { name: /50 cl/ }).check();
		await expect(page.getByTestId('modal-total')).toContainText('32 kr');
		await page.keyboard.press('Escape');
	});
});

test.describe('seo and locales', () => {
	test('unknown slug returns 404', async ({ page }) => {
		const response = await page.goto('/restaurants/not-a-real-restaurant');
		expect(response?.status()).toBe(404);
	});

	test('first server render with JS disabled has name, menu and JSON-LD', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto(DEMO);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Blinca Demo');
		await expect(page.getByTestId('restaurant-page')).toContainText('Margherita');
		await expect(page.getByTestId('restaurant-page')).toContainText('Klassisk burgare');
		const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
		expect(jsonLd.some((raw) => raw.includes('"@type":"Restaurant"'))).toBe(true);
		expect(jsonLd.some((raw) => raw.includes('openingHoursSpecification'))).toBe(true);
		const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
		expect(canonical).toBe('https://blinca.se/restaurants/blinca-demo');
		await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
		await context.close();
	});

	test('English renders with Swedish price formatting', async ({ page }) => {
		await setLocaleCookie(page, 'en');
		await page.goto(DEMO);
		await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Opening hours' })).toBeVisible();
		await expect(page.getByTestId('menu-item-row').first()).toContainText(/149 kr/);
	});
});

test.describe('accessibility', () => {
	test('page and open modal have no axe violations', async ({ page }) => {
		await page.goto(DEMO);
		const pageResults = await new AxeBuilder({ page }).analyze();
		expect(pageResults.violations, JSON.stringify(pageResults.violations, null, 2)).toEqual([]);
		await page.getByRole('button', { name: /Läs mer om Kebabpizza/ }).click();
		await expect(page.getByTestId('item-modal')).toBeVisible();
		const modalResults = await new AxeBuilder({ page }).analyze();
		expect(modalResults.violations, JSON.stringify(modalResults.violations, null, 2)).toEqual([]);
	});
});

test.describe('screenshots', () => {
	for (const width of [320, 390, 768, 1280]) {
		test(`restaurant at ${width}px (light)`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: 'light' });
			await page.setViewportSize({ width, height: 900 });
			await page.goto(DEMO);
			await page.screenshot({
				path: `e2e/screenshots/restaurant-${width}.png`,
				fullPage: true
			});
		});
	}
});
