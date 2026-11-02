/*
 * Design-match harness (dev-only). Spawns the SOURCE app (:5180) and the
 * customer app in design-check mode (:5173) as child processes, screenshots the
 * same routes/viewports with the same seeded local state + locale in both, and
 * pixel-diffs them (pixelmatch). Must run as one foreground process because this
 * sandbox kills backgrounded servers.
 *
 *   node e2e/design-match/compare.mjs [route...] [--vp=1440,1024,390,360]
 *
 * Exit 0 = every pair identical (0 differing pixels). Shots + diffs in
 * e2e/design-match/shots/.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { MASKS } from './masks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CUST_DIR = path.resolve(HERE, '../..');
const SRC_DIR = '/home/sappu/MyProjects/static/blinca-web-svelte';
const CUST = 'http://127.0.0.1:5173';
const SRC = 'http://127.0.0.1:5180';
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

// route name -> { src, cust } paths (same URL unless the customer differs)
const ALL_ROUTES = {
	home: { src: '/', cust: '/' },
	restaurant: { src: '/restaurants/blinca-demo', cust: '/restaurants/blinca-demo' },
	checkout: { src: '/checkout', cust: '/checkout' },
	account: { src: '/account', cust: '/account' },
	login: { src: '/login', cust: '/login' },
	info: { src: '/info/about', cust: '/info/about' },
	track: { src: '/orders/BL-10424', cust: '/orders/BL-10424' }
};
const ALL_VP = { 1440: [1440, 900], 1024: [1024, 800], 390: [390, 844], 360: [360, 780] };

const args = process.argv.slice(2);
const RAW = args.includes('--raw'); // show differences without the accepted-exception entries
const vpArg = args.find((a) => a.startsWith('--vp='));
const vps = (vpArg ? vpArg.slice(5).split(',') : ['1440']).filter((v) => ALL_VP[v]);
const routeNames = args.filter((a) => !a.startsWith('--'));
const routes = (routeNames.length ? routeNames : ['home']).filter((r) => ALL_ROUTES[r]);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function ping(base) {
	return new Promise((res, rej) => {
		const r = http.get(base + '/', (x) => {
			x.resume();
			res();
		});
		r.on('error', rej);
		r.setTimeout(4000, () => r.destroy(new Error('timeout')));
	});
}
async function up(base, log) {
	for (let i = 0; i < 90; i++) {
		try {
			await ping(base);
			return true;
		} catch {
			await wait(1000);
		}
	}
	throw new Error(`server not up: ${base}\n${log().slice(-1800)}`);
}

const cust = spawn(
	'node_modules/.bin/vite',
	['dev', '--port', '5173', '--strictPort', '--host', '127.0.0.1'],
	{
		cwd: CUST_DIR,
		env: { ...process.env, VITE_DESIGN_CHECK: '1' },
		stdio: ['ignore', 'pipe', 'pipe']
	}
);
const src = spawn(
	'node_modules/.bin/vite',
	['dev', '--port', '5180', '--strictPort', '--host', '127.0.0.1'],
	{
		cwd: SRC_DIR,
		stdio: ['ignore', 'pipe', 'pipe']
	}
);
let clog = '',
	slog = '';
cust.stdout.on('data', (d) => (clog += d));
cust.stderr.on('data', (d) => (clog += d));
src.stdout.on('data', (d) => (slog += d));
src.stderr.on('data', (d) => (slog += d));

const NO_ANIM =
	'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';

async function shoot(browser, base, urlPath, w, h, routeName) {
	const active = MASKS.filter((m) => !m.routes || m.routes.includes(routeName));
	const ctx = await browser.newContext({
		viewport: { width: w, height: h },
		deviceScaleFactor: 1,
		locale: 'en-US',
		// The customer app renders shop-local time (Europe/Stockholm); the source uses the
		// browser zone. Pin the zone so the result does not depend on the machine's TZ.
		timezoneId: 'Europe/Stockholm'
	});
	await ctx.addCookies([{ name: 'PARAGLIDE_LOCALE', value: 'en', url: base }]);
	await ctx.addInitScript(() => {
		try {
			localStorage.setItem('blinca.v1.lang', 'en');
			localStorage.setItem('PARAGLIDE_LOCALE', 'en');
		} catch {
			/* */
		}
		// Freeze clock + RNG identically in both apps so the (design-check) order
		// simulation — countdown, ETA, random courier — renders deterministically.
		const F = 1700000000000;
		const OD = Date;
		function D(...a) {
			return a.length ? new OD(...a) : new OD(F);
		}
		D.now = () => F;
		D.parse = OD.parse;
		D.UTC = OD.UTC;
		D.prototype = OD.prototype;
		globalThis.Date = D;
		let s = 123456789;
		Math.random = () => {
			s = (1103515245 * s + 12345) % 2147483648;
			return s / 2147483648;
		};
	});
	const page = await ctx.newPage();
	await page.goto(base + urlPath, { waitUntil: 'load', timeout: 30000 });
	await page.evaluate(() => document.fonts.ready).catch(() => {});
	await wait(1500); // hydration + seedIfNeeded + re-render
	await page.addStyleTag({ content: NO_ANIM });
	if (base === SRC && !RAW) {
		// Entries that hide an element the other side draws differently hide it here too.
		const css = active.filter((m) => m.srcCss).map((m) => m.srcCss);
		if (css.length) await page.addStyleTag({ content: css.join('\n') });
		for (const m of active) {
			if (m.srcSelector)
				maskHits[m.id + ':src'] =
					(maskHits[m.id + ':src'] || 0) + (await page.locator(m.srcSelector).count());
		}
	}
	if (base === CUST && !RAW) {
		await page.addStyleTag({
			content: active
				.map((m) => m.css)
				.filter(Boolean)
				.join('\n')
		});
		for (const m of active) {
			if (m.dropRule) {
				const n = await page.evaluate((needle) => {
					let dropped = 0;
					const walk = (list, owner) => {
						for (let i = list.length - 1; i >= 0; i--) {
							const r = list[i];
							if (r.selectorText !== undefined) {
								if (r.selectorText.includes(needle)) {
									owner.deleteRule(i);
									dropped++;
								}
							} else if (r.cssRules) walk(r.cssRules, r);
						}
					};
					for (const sheet of document.styleSheets) {
						try {
							walk(sheet.cssRules, sheet);
						} catch {
							/* cross-origin */
						}
					}
					return dropped;
				}, m.dropRule);
				maskHits[m.id] = (maskHits[m.id] || 0) + n;
			}
			if (!m.selector) continue;
			const n = await page.locator(m.selector).count();
			maskHits[m.id] = (maskHits[m.id] || 0) + n;
		}
	}
	// Normalise transient focus (autofocused inputs show a focus ring otherwise).
	await page.evaluate(() => {
		const el = document.activeElement;
		if (el && el.blur) el.blur();
	});
	await wait(200);
	const buf = await page.screenshot({ fullPage: true });
	await ctx.close();
	return buf;
}

// Every entry must name the test that covers its intended behaviour, and that file must exist.
for (const m of MASKS) {
	const files = (m.coveredBy || '').match(/(?:e2e|src)\/[\w./-]+\.(?:ts|mjs)/g) || [];
	if (!files.length || files.some((f) => !fs.existsSync(path.join(CUST_DIR, f)))) {
		console.log(
			`HARNESS FAIL: mask '${m.id}' has no existing covering test (coveredBy: ${m.coveredBy})`
		);
		process.exit(2);
	}
}
const fullRun =
	routes.length === Object.keys(ALL_ROUTES).length && vps.length === Object.keys(ALL_VP).length;
const maskHits = {}; // selector entries: how many elements they matched across all shots

const crop = (p, W, H) => {
	if (p.width === W && p.height === H) return p;
	const o = new PNG({ width: W, height: H });
	PNG.bitblt(p, o, 0, 0, W, H, 0, 0);
	return o;
};

try {
	await up(CUST, () => clog);
	await up(SRC, () => slog);
	const browser = await chromium.launch();
	const results = [];
	for (const vp of vps) {
		const [w, h] = ALL_VP[vp];
		for (const name of routes) {
			const R = ALL_ROUTES[name];
			const sBuf = await shoot(browser, SRC, R.src, w, h, name);
			const cBuf = await shoot(browser, CUST, R.cust, w, h, name);
			fs.writeFileSync(path.join(SHOTS, `${name}-${vp}-src.png`), sBuf);
			fs.writeFileSync(path.join(SHOTS, `${name}-${vp}-cust.png`), cBuf);
			const a = PNG.sync.read(sBuf),
				b = PNG.sync.read(cBuf);
			const W = Math.min(a.width, b.width),
				H = Math.min(a.height, b.height);
			const diff = new PNG({ width: W, height: H });
			const n = pixelmatch(crop(a, W, H).data, crop(b, W, H).data, diff.data, W, H, {
				threshold: 0.1
			});
			fs.writeFileSync(path.join(SHOTS, `${name}-${vp}-diff.png`), PNG.sync.write(diff));
			results.push({
				route: name,
				vp,
				diffPx: n,
				ratio: +(n / (W * H)).toFixed(6),
				src: `${a.width}x${a.height}`,
				cust: `${b.width}x${b.height}`
			});
		}
	}
	await browser.close();
	console.log(JSON.stringify(results, null, 2));
	const stale = MASKS.filter(
		(m) =>
			!RAW &&
			fullRun &&
			(((m.selector || m.dropRule) && !maskHits[m.id]) ||
				(m.srcSelector && !maskHits[m.id + ':src']))
	);
	if (stale.length)
		console.log('STALE mask entries (matched no element):', stale.map((m) => m.id).join(', '));
	console.log('mask hits:', JSON.stringify(maskHits));
	const bad = results.filter((r) => r.diffPx > 0);
	console.log(bad.length ? `\n${bad.length} pair(s) differ` : '\nALL IDENTICAL (0 diff pixels)');
	process.exitCode = bad.length || stale.length ? 1 : 0;
} catch (e) {
	console.log('HARNESS FAIL:', e.message);
	process.exitCode = 2;
} finally {
	cust.kill('SIGTERM');
	src.kill('SIGTERM');
}
