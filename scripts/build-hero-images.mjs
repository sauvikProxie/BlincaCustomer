#!/usr/bin/env node
/**
 * Generates the landing hero's responsive variants from the source photo.
 *
 * Source : src/lib/assets/hero/kottbullar.jpg  (not served; keep the original)
 * Output : static/hero/kottbullar-<width>.{avif,webp,jpg}
 *
 * Uses ImageMagick (`magick`) and `avifenc`, both already on this machine, so
 * no image-processing dependency is added to the project. Run after adding or
 * replacing the photo:  bun run images:hero
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src/lib/assets/hero/kottbullar.jpg');
const outDir = resolve(root, 'static/hero');
const widths = [640, 960, 1280, 1920, 2560];

if (!existsSync(source)) {
	console.error(
		`No hero photo at ${source}\n` +
			'Add the köttbullar photo there (landscape, 2400px wide or more), then re-run.'
	);
	process.exit(1);
}

function run(bin, args) {
	execFileSync(bin, args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const width of widths) {
	const base = resolve(outDir, `kottbullar-${width}`);
	// 16:9 crop keeps every variant the same shape, so the reserved box in the
	// markup matches whatever the browser picks.
	const crop = [
		'-resize',
		`${width}x`,
		'-gravity',
		'center',
		'-extent',
		`${width}x${Math.round((width * 9) / 16)}`
	];

	run('magick', [
		source,
		...crop,
		'-strip',
		'-quality',
		'72',
		'-interlace',
		'Plane',
		`${base}.jpg`
	]);
	run('magick', [
		source,
		...crop,
		'-strip',
		'-quality',
		'70',
		'-define',
		'webp:method=6',
		`${base}.webp`
	]);
	// avifenc wants a PNG/Y4M input, so stage one and remove it afterwards.
	const staged = `${base}.staged.png`;
	run('magick', [source, ...crop, '-strip', staged]);
	run('avifenc', [
		'--min',
		'0',
		'--max',
		'40',
		'--speed',
		'6',
		'--jobs',
		'all',
		staged,
		`${base}.avif`
	]);
	rmSync(staged, { force: true });

	console.log(`wrote kottbullar-${width}.{avif,webp,jpg}`);
}

console.log(`\nDone — ${widths.length * 3} files in static/hero/`);
