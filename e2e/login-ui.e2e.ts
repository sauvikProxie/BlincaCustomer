import { expect, test, type Page } from '@playwright/test';
import {
	CUSTOMER_EMAIL as EMAIL,
	CUSTOMER_PASSWORD as PASSWORD,
	gotoLogin,
	signIn
} from './support/signIn';

const SHOT_DIR = 'test-results/login';

/** Forces a theme through the toggle and waits for <html data-theme> to follow. */
async function chooseTheme(page: Page, choice: 'light' | 'dark' | 'system') {
	await page.locator(`[data-theme-choice="${choice}"]`).click();
	if (choice === 'system') {
		await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
	} else {
		await expect(page.locator('html')).toHaveAttribute('data-theme', choice);
	}
}

test('renders in Swedish by default', async ({ page }) => {
	await gotoLogin(page);

	await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
	await expect(page.getByRole('heading', { name: 'Logga in' })).toBeVisible();
	// exact: true — the reveal button's "Visa lösenord" label would match too.
	await expect(page.getByLabel('E-postadress', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Lösenord', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Skapa konto' })).toHaveAttribute('href', '/signup');
	await expect(page.getByRole('link', { name: 'Glömt lösenordet?' })).toHaveAttribute(
		'href',
		'/forgot-password'
	);
});

test('the language switch moves between Swedish and English', async ({ page }) => {
	await gotoLogin(page);
	await expect(page.getByRole('heading', { name: 'Logga in' })).toBeVisible();

	/*
	 * setLocale() writes the cookie and reloads so SSR matches. The second
	 * click has to wait for that reload to hydrate — the auth client's session
	 * fetch is the signal — or it lands on the DOM before Svelte has attached
	 * the handler and silently does nothing.
	 */
	const reloaded = page.waitForResponse((res) => res.url().includes('/api/auth/get-session'));
	await page.getByRole('button', { name: 'Engelska' }).click();
	await reloaded;

	await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Swedish' }).click();
	await expect(page.getByRole('heading', { name: 'Logga in' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
});

test('empty fields show validation errors and never reach the backend', async ({ page }) => {
	await gotoLogin(page);

	let signInCalls = 0;
	page.on('request', (req) => {
		if (req.url().includes('/api/auth/sign-in')) signInCalls += 1;
	});

	await page.locator('form button[type="submit"]').click();

	await expect(page.locator('#email-error')).toHaveText('Ange din e-postadress.');
	await expect(page.locator('#password-error')).toHaveText('Ange ditt lösenord.');
	await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
	await expect(page.locator('#password')).toHaveAttribute('aria-invalid', 'true');
	expect(signInCalls).toBe(0);

	// A malformed address is caught by the same schema.
	await page.locator('#email').fill('not-an-address');
	await page.locator('#email').blur();
	await expect(page.locator('#email-error')).toHaveText('Ange en giltig e-postadress.');
	expect(signInCalls).toBe(0);
});

test('the password reveal toggle switches the input type', async ({ page }) => {
	await gotoLogin(page);

	const password = page.locator('#password');
	await password.fill('password123');
	await expect(password).toHaveAttribute('type', 'password');

	const reveal = page.getByRole('button', { name: 'Visa lösenord' });
	await reveal.click();
	await expect(password).toHaveAttribute('type', 'text');
	await expect(page.getByRole('button', { name: 'Dölj lösenord' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.getByRole('button', { name: 'Dölj lösenord' }).click();
	await expect(password).toHaveAttribute('type', 'password');
});

test('the submit button presses in', async ({ page }) => {
	await gotoLogin(page);

	const button = page.locator('form button[type="submit"]');
	const styles = () =>
		button.evaluate((el) => {
			const s = getComputedStyle(el);
			return { boxShadow: s.boxShadow, transform: s.transform };
		});

	const resting = await styles();

	expect(resting.transform).toBe('none');

	const box = await button.boundingBox();
	if (!box) throw new Error('submit button has no bounding box');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	// --transition-tactile runs for 120ms; read the settled value, not a frame
	// part-way through it.
	await page.waitForTimeout(250);
	const pressed = await styles();
	// Released away from the button so no sign-in attempt is spent here.
	await page.mouse.move(box.x + box.width / 2, box.y + box.height * 3);
	await page.mouse.up();

	// Raised (4 layers, outward) swaps for pressed (2 layers, inset).
	expect(pressed.boxShadow).not.toBe(resting.boxShadow);
	expect(pressed.boxShadow).toContain('inset');
	expect(pressed.boxShadow).not.toContain('8px 16px');
	// translateY(1px): the key physically sinks.
	expect(pressed.transform).toBe('matrix(1, 0, 0, 1, 0, 1)');
});

test('light and dark themes both render', async ({ page }) => {
	await gotoLogin(page);

	await chooseTheme(page, 'light');
	const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	await expect(page.getByRole('heading', { name: 'Logga in' })).toBeVisible();
	await page.screenshot({ path: `${SHOT_DIR}/light.png`, fullPage: true });

	await chooseTheme(page, 'dark');
	const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	await expect(page.getByRole('heading', { name: 'Logga in' })).toBeVisible();
	await page.screenshot({ path: `${SHOT_DIR}/dark.png`, fullPage: true });

	expect(lightBg).toBe('rgb(250, 248, 245)');
	expect(darkBg).toBe('rgb(31, 31, 31)');

	// The choice survives a reload, applied before paint by the inline script.
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('the card fits a 320px viewport without horizontal scroll', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await gotoLogin(page);

	const overflows = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
	expect(overflows).toBe(false);
});

test('wrong password shows the general error, correct credentials sign in', async ({ page }) => {
	await signIn(page, EMAIL, 'not-the-password');
	await expect(page.getByTestId('login-error')).toHaveText('Fel e-postadress eller lösenord.');
	await expect(page).toHaveURL(/\/login/);

	await signIn(page, EMAIL, PASSWORD);
	await expect(page).toHaveURL(/\/dashboard/);
});

test('sign-in returns the visitor to the page they asked for', async ({ page }) => {
	// /account bounces a signed-out visitor to /login?next=/account.
	await page.goto('/account');
	await expect(page).toHaveURL(/\/login\?next=%2Faccount/);

	await signIn(page, EMAIL, PASSWORD, '/account');
	await expect(page).toHaveURL(/\/account/);
});

// The `preferredLanguage` strategy means an English browser never sees the
// Swedish base locale first, even with no cookie set.
test.describe('an English browser', () => {
	test.use({ locale: 'en-US' });

	test('gets the page in English without choosing', async ({ page }) => {
		await gotoLogin(page);

		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
	});
});
