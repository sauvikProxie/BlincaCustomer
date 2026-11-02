#!/usr/bin/env node
/**
 * Fails if the production build output contains any .map file, or any
 * sourceMappingURL comment in a shipped .js/.css file. Run after `vite build`
 * (wired into the `build` script itself, so this can never be skipped).
 *
 * Checks `.svelte-kit/cloudflare`, the exact tree the adapter deploys —
 * not the intermediate `.svelte-kit/output/server` build directory, which
 * SvelteKit's own server build may use internally for stack traces and never
 * ships to Cloudflare.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const DEPLOY_DIR = '.svelte-kit/cloudflare';
const SOURCE_MAPPING_RE = /sourceMappingURL=/;

/** @type {string[]} */
const violations = [];

function walk(dir) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stats = statSync(full);
		if (stats.isDirectory()) {
			walk(full);
			continue;
		}
		if (extname(full) === '.map') {
			violations.push(`${full}: a .map file was shipped`);
			continue;
		}
		if (extname(full) === '.js' || extname(full) === '.css') {
			const content = readFileSync(full, 'utf-8');
			if (SOURCE_MAPPING_RE.test(content)) {
				violations.push(`${full}: contains a sourceMappingURL comment`);
			}
		}
	}
}

try {
	walk(DEPLOY_DIR);
} catch (err) {
	console.error(`Could not read ${DEPLOY_DIR} — run \`vite build\` first.`);
	console.error(err);
	process.exit(1);
}

if (violations.length > 0) {
	console.error(`✘ Found ${violations.length} sourcemap leak(s) in ${DEPLOY_DIR}:\n`);
	for (const v of violations) console.error(`  ${v}`);
	process.exit(1);
}

console.log(`✓ No source maps in ${DEPLOY_DIR} — no .map files, no sourceMappingURL comments.`);
