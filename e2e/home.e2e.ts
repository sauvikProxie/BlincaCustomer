import { expect, test, type ConsoleMessage } from '@playwright/test';
import { STORAGE_STATE } from './support/signIn';

/**
 * Customer home page (/) — the marketplace, rendered from the seeded backend
 * (seed:dev + seed:marketplace). Public page, no sign-in needed:
 *
 *   CUSTOMER_BASE_URL=http://localhost:5173 \
 *     bunx playwright test e2e/home.e2e.ts --no-deps --project=chromium
 *
 * The chromium project uses a Swedish locale, so the default render is Swedish.
 */

function countFromText(text: string | null): number {
	const match = text?.match(/\d+/);
	return match ? Number(match[0]) : NaN;
}

/** Load and wait for hydration, so click handlers are attached before we act. */
async function openHome(page: import('@playwright/test').Page) {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
}

test('renders the marketplace home with one h1 and the Blinca logo', async ({ page }) => {
	await openHome(page);

	await expect(page.locator('h1')).toHaveCount(1);
	await expect(page.locator('header img').first()).toHaveAttribute('src', /logo\.svg/);

	await expect(page.getByRole('searchbox')).toBeVisible();
	await expect(page.locator('#all-restaurants article').first()).toBeVisible();
});

test('filtering and search narrow the restaurant list, with an empty state', async ({ page }) => {
	await openHome(page);

	const count = page.locator('#all-title .count');
	const initial = countFromText(await count.textContent());
	expect(initial).toBeGreaterThan(5);

	// A quick filter reduces the list.
	await page.getByRole('button', { name: 'Fri leverans', exact: true }).click();
	await expect.poll(async () => countFromText(await count.textContent())).toBeLessThan(initial);

	// Searching nonsense shows the empty state; clearing restores the list.
	await page.getByRole('searchbox').fill('xyzzy-nothing');
	await page.getByRole('searchbox').press('Enter');
	await expect(page.getByRole('heading', { name: 'Inga restauranger matchar' })).toBeVisible();
	await page.getByRole('button', { name: 'Rensa alla' }).first().click();
	await expect(page.locator('#all-restaurants article').first()).toBeVisible();
});

test('a restaurant card opens the restaurant page', async ({ page }) => {
	await openHome(page);

	const link = page.locator('#all-restaurants article h3 a').first();
	const href = await link.getAttribute('href');
	await link.click();
	await expect(page).toHaveURL(new RegExp(`${href}$`));
});

// Adding to the bag needs an account (a guest is sent to sign up), so reuse the saved session.
test.describe('signed in', () => {
	test.use({ storageState: STORAGE_STATE });

	test('adding a dish from the home puts it in the bag', async ({ page }) => {
		await openHome(page);

		// The saved cart may already hold dishes: compare the badge before and after.
		const badge = page.locator('button.cart .cart-n');
		const bagCount = async () =>
			countFromText(await badge.textContent({ timeout: 500 }).catch(() => '0'));
		const before = await bagCount();
		await page
			.getByRole('button', { name: /^Lägg till / })
			.first()
			.click();
		// The seeded dishes have options, so the item dialog opens first.
		await page
			.getByRole('dialog')
			.getByRole('button', { name: /^Lägg till ·/ })
			.click();
		await expect.poll(bagCount).toBeGreaterThan(before);
	});
});

test('the language switch flips Swedish and English instantly', async ({ page }) => {
	await openHome(page);

	// Default is Swedish.
	await expect(page.locator('h1')).toHaveText(/Vad är du sugen på/);

	// Open the language menu and pick English.
	await page.getByRole('button', { name: 'Språk' }).click();
	await page.getByRole('menuitemradio', { name: /^EN/ }).click();

	// English now renders without a navigation.
	await expect(page.locator('h1')).toHaveText(/hungry/i);
});

test('loads with no console errors', async ({ page }) => {
	const problems: string[] = [];
	const onConsole = (message: ConsoleMessage) => {
		if (message.type() === 'error') problems.push(message.text());
	};
	page.on('console', onConsole);
	page.on('pageerror', (error) => problems.push(error.message));

	await page.goto('/', { waitUntil: 'networkidle' });
	expect(problems).toEqual([]);
});
