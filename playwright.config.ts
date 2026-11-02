import { defineConfig, devices } from '@playwright/test';

// Runs against already-running dev servers (backend + customer app), since the
// login flow needs a live Convex deployment with seeded data. See README.
export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.{ts,js}',
	testIgnore: '**/mocked/**',
	timeout: 60_000,
	fullyParallel: false,
	// One worker so e2e/support/signIn.ts can space sign-in attempts across
	// specs: Better Auth's limiter counts them per IP, not per file.
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: process.env.CUSTOMER_BASE_URL ?? 'http://localhost:5173',
		trace: 'retain-on-failure'
	},
	projects: [
		// Signs in once and saves the session for the specs that need one.
		{
			name: 'setup',
			testMatch: /customer\.setup\.ts$/,
			use: { ...devices['Desktop Chrome'], locale: 'sv-SE' }
		},
		// A Swedish browser, so the default render is the base locale. The
		// `preferredLanguage` strategy means an en-US browser gets English
		// instead — login-ui.e2e.ts covers that case explicitly.
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], locale: 'sv-SE' },
			dependencies: ['setup']
		}
	]
});
