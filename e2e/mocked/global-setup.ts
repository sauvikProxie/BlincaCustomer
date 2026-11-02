import { chromium } from '@playwright/test';

/** Warms Vite's dev server (dep optimisation + first SSR) so the first test is not a cold start. */
export default async function globalSetup() {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	for (const url of ['/restaurants/blinca-demo', '/checkout', '/']) {
		await page.goto('http://localhost:5180' + url, { timeout: 90_000 });
		await page
			.waitForSelector('body[data-page]', { state: 'attached', timeout: 90_000 })
			.catch(() => {});
	}
	await browser.close();
}
