import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	build: {
		// Belt-and-braces: Vite already defaults to no sourcemaps for a
		// production build, but this makes the intent explicit and durable
		// against a future plugin or dependency bump flipping the default.
		// scripts/check-no-sourcemaps.mjs verifies the shipped output.
		sourcemap: false
	},
	server: {
		watch: {
			// The workspace link node_modules/@blinca/backend resolves into
			// packages/backend, whose .convex/local sqlite churns on every
			// backend write (sessions, rate limits, crons) and was restarting
			// the SSR server in a loop. Dev-only; builds don't watch.
			ignored: ['**/.convex/local/**']
		}
	},
	plugins: [
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// Cookie first so the switcher sticks, then the browser's own
			// Accept-Language, then Swedish. No locale in the URL, so no
			// reroute hook and no change to existing routes.
			strategy: ['cookie', 'preferredLanguage', 'baseLocale']
		}),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				experimental: { async: true }
			},
			adapter: adapter(),
			experimental: { remoteFunctions: true },
			// Set only by playwright.mocked.config.ts so its dev server never rewrites the normal one's generated env.
			...(process.env.SVELTEKIT_OUT_DIR && { outDir: process.env.SVELTEKIT_OUT_DIR })
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
