import { expect, type Page } from '@playwright/test';

export async function openDrawer(page: Page) {
	// The label carries the count and total once the cart has lines ("Varukorg 1 119 kr").
	await page.locator('button[aria-label^="Varukorg"]:visible').click();
	await expect(page.locator('.drawer-cart')).toBeVisible();
}

export async function clearCart(page: Page) {
	await openDrawer(page);
	const remove = page.getByRole('button', { name: 'Ta bort' });
	// The drawer list re-renders as live Convex updates stream in, which can
	// detach a button mid-click: dispatch directly and re-resolve each round.
	for (let i = 0; i < 10; i++) {
		if ((await remove.count()) === 0) break;
		await remove
			.first()
			.dispatchEvent('click')
			.catch(() => {});
		await page.waitForTimeout(1500);
	}
	await page.keyboard.press('Escape');
	await expect(page.locator('.drawer-wrap.is-open')).toHaveCount(0);
}

export async function badgeCount(page: Page): Promise<number> {
	// Desktop island shows .cart-n, mobile header shows .badge (one of them
	// is always display:none — :visible picks the rendered one).
	const badge = page.locator('.island-wrap .cart-n:visible, header .badge:visible');
	if ((await badge.count()) === 0) return 0;
	return Number((await badge.first().textContent()) ?? 0);
}
