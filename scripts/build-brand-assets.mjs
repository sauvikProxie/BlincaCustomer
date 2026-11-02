#!/usr/bin/env node
/**
 * Generates the favicon set, the PWA icons and the default social share image
 * from the official Blinca brand kit (repo-root `logo/`):
 *   - 02-App-Icon/blinca-app-icon-square-1024.png  → favicons, PWA icons,
 *     apple-touch-icon. It is already the white symbol on a Cranberry tile, so
 *     it reads at every size without squeezing the wordmark in.
 *   - 01-Logo/PNG/blinca-lockup-white.png          → the Open Graph lockup.
 *
 * Uses ImageMagick (`magick`), already on this machine — no image dependency is
 * added to the project. Run after the brand kit changes:  bun run images:brand
 *
 * The logo is only ever trimmed, scaled and placed on a Cranberry surface. It
 * is never redrawn, recoloured, stretched or re-spaced (DESIGN.md §2).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(root, '../..');
const brand = resolve(repoRoot, 'logo');
const appIcon = resolve(brand, '02-App-Icon/blinca-app-icon-square-1024.png');
const lockupWhite = resolve(brand, '01-Logo/PNG/blinca-lockup-white.png');
const staticDir = resolve(root, 'static');
const tmp = resolve(root, '.brand-tmp');

// DESIGN.md §4: Cranberry is the brand surface; Cranberry Deep is for buttons.
const CRANBERRY = '#E23744';

for (const [label, path] of [
	['app icon', appIcon],
	['white lockup', lockupWhite]
]) {
	if (!existsSync(path)) {
		console.error(`Brand ${label} not found at ${path}`);
		process.exit(1);
	}
}

const run = (bin, args) => execFileSync(bin, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

/*
 * 1. Favicons and PWA icons. The app-icon tile already carries its own
 *    background and padding, so these are a straight resize — no plate, no
 *    recolour. A 32px PNG for modern tabs, a multi-size .ico for legacy, the
 *    maskable PWA pair, and the apple-touch icon (iOS rounds the corners).
 */
const icon = (size, out) => run('magick', [appIcon, '-resize', `${size}x${size}`, '-strip', out]);

icon(32, resolve(staticDir, 'favicon-32.png'));
icon(180, resolve(staticDir, 'apple-touch-icon.png'));
icon(192, resolve(staticDir, 'icon-192.png'));
icon(512, resolve(staticDir, 'icon-512.png'));

for (const size of [16, 32, 48]) icon(size, resolve(tmp, `ico-${size}.png`));
run('magick', [
	resolve(tmp, 'ico-16.png'),
	resolve(tmp, 'ico-32.png'),
	resolve(tmp, 'ico-48.png'),
	resolve(staticDir, 'favicon.ico')
]);

/*
 * 2. Social share image, 1200x630: the white lockup centred on a flat Cranberry
 *    field. Flat colour + a vector-sourced lockup keeps the PNG well under the
 *    300 KB budget.
 */
const og = resolve(staticDir, 'og-default.png');
const plate = resolve(tmp, 'plate.png');
// Lockup at ~44% of the canvas width, with clear space around it.
run('magick', [lockupWhite, '-resize', '620x', '-strip', plate]);
run('magick', [
	'-size',
	'1200x630',
	`xc:${CRANBERRY}`,
	plate,
	'-gravity',
	'center',
	'-composite',
	'-strip',
	resolve(staticDir, 'og-default.png')
]);

rmSync(tmp, { recursive: true, force: true });

console.log('Wrote:');
for (const file of [
	'favicon.ico',
	'favicon-32.png',
	'apple-touch-icon.png',
	'icon-192.png',
	'icon-512.png',
	'og-default.png'
]) {
	console.log(`  ${file.padEnd(22)} ${kb(resolve(staticDir, file))}`);
}
if (statSync(og).size > 300 * 1024) {
	console.warn(`\n⚠ og-default.png is over 300 KB (${kb(og)}).`);
}
