#!/usr/bin/env node
/**
 * Converts the mock food photos used by the home page into responsive AVIF +
 * WebP (two widths) with a JPEG fallback, written to static/food/.
 *
 * Source: the design zip's `website/img/` (Unsplash photos, 800x600). Only the
 * photos the home page actually references are converted (see USED below) — the
 * heroes and unused extras are skipped. The photographer credits are kept in
 * static/food/CREDITS.txt and surfaced in the footer ("Matbilder från
 * Unsplash"), per DESIGN.md §10.
 *
 * Uses ImageMagick (`magick`), already on this machine. Re-run after changing
 * the source set:  bun run images:food
 *
 * The source directory is passed explicitly and only read from; nothing is
 * executed out of it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR =
	process.env.BLINCA_PHOTO_SRC ||
	resolve(root, '../../../Blinca Design/website-design-blinca/website/img');
const outDir = resolve(root, 'static/food');

// The exact photos the home page uses (restaurant cards, dishes, cuisines,
// offers and banner). Keep in sync with src/lib/mock/home.ts.
const USED = [
	'pizza-1',
	'pizza-2',
	'pizza-3',
	'sushi-1',
	'sushi-2',
	'burger-1',
	'burger-2',
	'bowl-1',
	'bowl-2',
	'ramen-1',
	'ramen-2',
	'tacos-1',
	'curry-1',
	'curry-2',
	'thai-1',
	'dumplings-1',
	'pasta-2',
	'kebab-1',
	'steak-1',
	'breakfast-1',
	'coffee-1',
	'dessert-1',
	'cake-1',
	'salad-1',
	'fries-1',
	'groceries-1'
];

const WIDTHS = [400, 800]; // source photos are 800px wide — no upscaling.

if (!existsSync(SRC_DIR)) {
	console.error(`Photo source not found: ${SRC_DIR}`);
	console.error('Set BLINCA_PHOTO_SRC to the design zip website/img directory.');
	process.exit(1);
}

const run = (args) => execFileSync('magick', args, { stdio: ['ignore', 'ignore', 'inherit'] });

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let count = 0;
for (const name of USED) {
	const src = resolve(SRC_DIR, `${name}.jpg`);
	if (!existsSync(src)) {
		console.warn(`  skip (missing): ${name}.jpg`);
		continue;
	}
	for (const w of WIDTHS) {
		run([
			src,
			'-resize',
			`${w}x`,
			'-strip',
			'-quality',
			'48',
			resolve(outDir, `${name}-${w}.avif`)
		]);
		run([
			src,
			'-resize',
			`${w}x`,
			'-strip',
			'-quality',
			'72',
			'-define',
			'webp:method=6',
			resolve(outDir, `${name}-${w}.webp`)
		]);
		count += 2;
	}
	// One JPEG fallback at the largest width for the <img src>.
	run([src, '-resize', '800x', '-strip', '-quality', '80', resolve(outDir, `${name}-800.jpg`)]);
	count += 1;
}

const total = readdirSync(outDir)
	.filter((f) => /\.(avif|webp|jpg)$/.test(f))
	.reduce((sum, f) => sum + statSync(resolve(outDir, f)).size, 0);

console.log(`\nWrote ${count} files for ${USED.length} photos → static/food/`);
console.log(`Total: ${(total / 1024).toFixed(0)} KB`);
