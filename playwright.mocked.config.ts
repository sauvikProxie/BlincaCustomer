import { defineConfig, devices } from '@playwright/test';

// Backend-free: the app runs in design-check mode (VITE_DESIGN_CHECK=1, dev only),
// where nothing talks to Convex and state is local. Own server on :5180 so it never
// touches the shared dev backend / :5173.
export default defineConfig({
	testDir: './e2e/mocked',
	testMatch: '**/*.e2e.{ts,js}',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	workers: 1,
	globalSetup: './e2e/mocked/global-setup.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: 'list',
	use: { baseURL: 'http://localhost:5180', trace: 'retain-on-failure' },
	webServer: {
		command: 'node_modules/.bin/vite dev --port 5180 --strictPort --host localhost',
		// Empty Mapbox token: the mocked app never loads Mapbox (and exercises the no-token fallback).
		env: {
			VITE_DESIGN_CHECK: '1',
			NODE_ENV: 'development',
			PUBLIC_MAPBOX_ACCESS_TOKEN: '',
			// Own SvelteKit output dir: never overwrite the normal dev server's .svelte-kit/generated env.
			SVELTEKIT_OUT_DIR: '.svelte-kit-mocked'
		},
		// Poll a real page (not /): the very first SSR request can 500 while the dev server warms up.
		url: 'http://localhost:5180/restaurants/blinca-demo',
		reuseExistingServer: false,
		timeout: 120_000
	},
	projects: [
		{ name: 'sv', use: { ...devices['Desktop Chrome'], locale: 'sv-SE' } },
		{ name: 'en', use: { ...devices['Desktop Chrome'], locale: 'en-US' } }
	]
});
