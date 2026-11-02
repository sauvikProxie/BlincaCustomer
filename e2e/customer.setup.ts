import { test as setup } from '@playwright/test';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, STORAGE_STATE, signIn } from './support/signIn';

// Runs once before the other projects. Specs that reuse STORAGE_STATE then
// cost no sign-in attempts against Better Auth's per-IP limiter.
setup('sign the test customer in once', async ({ page }) => {
	await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, '/');
	await page.waitForURL(/localhost:5173\/(\?.*)?$/);
	await page.context().storageState({ path: STORAGE_STATE });
});
