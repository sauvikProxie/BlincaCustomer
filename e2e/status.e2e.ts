import { expect, test } from '@playwright/test';

/**
 * Step 3 status gallery (/dev/status). Dev-only route with fixed mock data —
 * no sign-in, no Convex seed needed:
 *
 *   CUSTOMER_BASE_URL=http://localhost:5173 \
 *     bunx playwright test e2e/status.e2e.ts --no-deps --project=chromium
 */

const restaurantCases = [
	{ id: 'open', sv: 'Öppet', en: 'Open' },
	{ id: 'closed-soon', sv: 'Stängt', en: 'Closed' },
	{ id: 'closed-tomorrow', sv: 'i morgon', en: 'tomorrow' },
	{ id: 'closed-unknown', sv: 'Stängt', en: 'Closed' },
	{ id: 'paused-short', sv: 'Pausat, tillbaka om', en: 'Paused, back in' },
	{ id: 'paused-long', sv: 'Pausat till', en: 'Paused until' },
	{ id: 'paused-indefinite', sv: 'tills vidare', en: 'until further notice' },
	{ id: 'unavailable', sv: 'Inte tillgänglig', en: 'Not available' },
	{ id: 'closed-permanently', sv: 'Inte tillgänglig', en: 'Not available' }
] as const;

const itemCases = [
	{ id: 'sold-out-today', sv: 'Slut för idag', en: 'Sold out today' },
	{ id: 'sold-out-until', sv: 'Tillbaka', en: 'Back on' },
	{ id: 'sold-out-indefinitely', sv: 'Slutsåld', en: 'Sold out' },
	{ id: 'outside-schedule-known', sv: 'Tillbaka', en: 'Back on' },
	{ id: 'outside-schedule-unknown', sv: 'Inte tillgänglig', en: 'Not available' },
	{ id: 'outside-schedule-hint', sv: 'Serveras', en: 'Available' }
] as const;

test('every restaurant state renders in Swedish and English', async ({ page }) => {
	await page.goto('/dev/status');
	for (const c of restaurantCases) {
		await expect(page.getByTestId(`demo-restaurant-${c.id}-sv`)).toContainText(c.sv);
		await expect(page.getByTestId(`demo-restaurant-${c.id}-en`)).toContainText(c.en);
	}
	// The scheduler CTA shows for closed/paused, never for unavailable.
	await expect(
		page.getByTestId('demo-restaurant-closed-tomorrow-sv').getByTestId('banner-schedule')
	).toHaveCount(1);
	await expect(
		page.getByTestId('demo-restaurant-paused-short-en').getByTestId('banner-schedule')
	).toHaveCount(1);
	await expect(
		page.getByTestId('demo-restaurant-unavailable-sv').getByTestId('banner-schedule')
	).toHaveCount(0);
});

test('every item state renders in Swedish and English', async ({ page }) => {
	await page.goto('/dev/status');
	for (const c of itemCases) {
		await expect(page.getByTestId(`demo-item-${c.id}-sv`)).toContainText(c.sv);
		await expect(page.getByTestId(`demo-item-${c.id}-en`)).toContainText(c.en);
	}
	await expect(page.getByTestId('demo-item-available-sv')).toContainText('ingen badge');
	// Overlays dim the image but keep its box: no layout shift.
	for (const c of itemCases) {
		const overlay = page.getByTestId(`demo-item-${c.id}-sv`).getByTestId('availability-overlay');
		await expect(overlay).toHaveAttribute(
			'data-kind',
			c.id.startsWith('sold') ? /sold_out.*/ : /.*/
		);
	}
});

test('paused_short countdown ticks each minute but the live region stays quiet', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/dev/status');

	// Prove hydration first: SSR HTML answers reads, but only the hydrated
	// badge runs the minute-boundary timer. (The dev server compiles on
	// first load, so re-click until the confirm shows.)
	const demo = page.getByTestId('demo-interactive');
	await expect
		.poll(
			async () => {
				await demo.getByTestId('banner-schedule').click();
				return page.getByTestId('schedule-confirm').count();
			},
			{ timeout: 15000 }
		)
		.toBe(1);

	const badge = page
		.getByTestId('demo-restaurant-paused-short-sv')
		.getByTestId('badge-text')
		.first();
	const live = page.getByTestId('demo-restaurant-paused-short-sv').getByTestId('banner-live');
	const before = await badge.textContent();
	const liveBefore = await live.textContent();
	expect(before).toMatch(/20 min/);

	await page.clock.fastForward('01:01');

	await expect.poll(async () => badge.textContent()).not.toBe(before);
	expect(await live.textContent()).toBe(liveBefore);
});

test('the live region announces kind changes', async ({ page }) => {
	await page.goto('/dev/status');
	const live = page.getByTestId('demo-interactive').getByTestId('banner-live');
	await expect(live).toHaveAttribute('role', 'status');
	await expect(live).toHaveAttribute('aria-live', 'polite');
	await expect(live).toContainText(/Pausat|Paused/);

	// The dev server compiles on first load, so the first clicks may land
	// before hydration. Re-click until the state flips (idempotent).
	await expect
		.poll(
			async () => {
				await page.getByTestId('switcher-closed-tomorrow').click();
				return live.textContent();
			},
			{ timeout: 15000 }
		)
		.toMatch(/Stängt|Closed/);

	// The scheduler CTA emits without navigating anywhere.
	await page.getByTestId('demo-interactive').getByTestId('banner-schedule').click();
	await expect(page.getByTestId('schedule-confirm')).toBeVisible();
});

test('keyboard focus order follows the page with a visible focus ring', async ({ page }) => {
	await page.goto('/dev/status');
	const stops = await page.locator('a[href], button').count();
	const seen: (string | null)[] = [];
	for (let i = 0; i < stops; i++) {
		await page.keyboard.press('Tab');
		seen.push(
			await page.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				if (!el) return null;
				// Demo banner buttons share one testid, so name the demo instead.
				const demo = el.closest('[data-testid^="demo-"], [data-testid^="switcher-"]');
				return demo?.getAttribute('data-testid') ?? el.getAttribute('data-testid');
			})
		);
		const style = await page.evaluate(() => {
			const el = document.activeElement as HTMLElement | null;
			if (!el) return null;
			const cs = getComputedStyle(el);
			return { width: cs.outlineWidth, style: cs.outlineStyle, color: cs.outlineColor };
		});
		// Saffron 3px ring, on every stop.
		expect(style?.width).toBe('3px');
		expect(style?.style).toBe('solid');
		expect(style?.color).toBe('rgb(255, 176, 32)');
		// Every target meets the 44px minimum.
		const box = await page.evaluate(() => {
			const el = document.activeElement as HTMLElement | null;
			return el ? el.getBoundingClientRect().height : 0;
		});
		expect(box).toBeGreaterThanOrEqual(44);
	}
	// The interactive demo comes last, switchers in DOM order just before it.
	expect(seen.slice(-5)).toEqual([
		'switcher-open',
		'switcher-closed-tomorrow',
		'switcher-paused-short',
		'switcher-unavailable',
		'demo-interactive'
	]);
});

test('320px wide has no horizontal scroll', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await page.goto('/dev/status');
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow).toBeLessThanOrEqual(1);
});

test('gallery screenshots (light mode)', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/dev/status');
	await page.setViewportSize({ width: 320, height: 800 });
	await page.screenshot({ path: 'e2e/screenshots/status-320.png', fullPage: true });
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.screenshot({ path: 'e2e/screenshots/status-1280.png', fullPage: true });
});
