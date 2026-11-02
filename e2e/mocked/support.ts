import { readFileSync } from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';

type Messages = Record<string, string>;
const load = (l: string): Messages =>
	JSON.parse(readFileSync(new URL(`../../messages/${l}.json`, import.meta.url), 'utf8'));
const MSG: Record<string, Messages> = { en: load('en'), sv: load('sv') };

export const locale = (info: TestInfo): 'en' | 'sv' => (info.project.name === 'en' ? 'en' : 'sv');

/** Localized text for a source key ('item.required') or a Paraglide key ('reset_hint'). */
export function tr(
	info: TestInfo,
	key: string,
	vars: Record<string, string | number> = {}
): string {
	const msgs = MSG[locale(info)];
	const raw = msgs['src_' + key.replace(/[.-]/g, '_')] ?? msgs[key];
	if (raw === undefined) throw new Error('missing message ' + key);
	return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Seeds blinca.v1.* before the app boots: empty cart/orders, signed-in demo user. */
export async function seedEmpty(page: Page, extra: Record<string, unknown> = {}) {
	await page.addInitScript((extra) => {
		if (localStorage.getItem('blinca.v1.seeded')) return;
		const set = (k: string, v: unknown) =>
			localStorage.setItem('blinca.v1.' + k, JSON.stringify(v));
		set('cart', []);
		set('orders', []);
		set('favorites', []);
		set('address', 'home');
		set('user', { name: 'Anna Svensson', email: 'anna@example.se', phone: '' });
		set('myAddresses', []);
		set('promo', null);
		set('mode', 'delivery');
		for (const [k, v] of Object.entries(extra)) set(k, v);
		set('seeded', true);
	}, extra);
}

/**
 * Rewrites the dev sample data the client loads (data.dev.js) before it runs.
 * `body` is the source of a function `(out) => void` that mutates the result
 * of devData(). SSR still renders the unmodified data; the client replaces it.
 */
export async function mutateData(page: Page, body: string) {
	await page.route(/\/src\/lib\/data\.dev\.js/, async (route) => {
		const res = await route.fetch();
		let text = await res.text();
		const needle = 'return { restaurants: mockRestaurants(), addresses, popular, trending, seed };';
		if (!text.includes(needle)) throw new Error('data.dev.js return statement changed');
		text = text.replace(
			needle,
			`const out = { restaurants: mockRestaurants(), addresses, popular, trending, seed }; (${body})(out); return out;`
		);
		await route.fulfill({ response: res, body: text });
	});
}

export const noHScroll = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** goto + wait for hydration (the layout stamps body[data-page] in an effect). */
export async function open(page: Page, url: string) {
	await page.goto(url);
	await page.waitForSelector('body[data-page]', { state: 'attached' });
}

const DISHES = {
	burger: { en: 'Classic burger', sv: 'Klassisk burgare' },
	margherita: { en: 'Margherita', sv: 'Margherita' },
	halloumi: { en: 'Halloumi burger', sv: 'Halloumiburgare' }
};
/** Localized sample-dish name (blinca-demo). */
export const dish = (info: TestInfo, id: keyof typeof DISHES) => DISHES[id][locale(info)];
