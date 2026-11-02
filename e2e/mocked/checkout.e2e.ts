import { expect, test } from '@playwright/test';
import { esc, open, tr } from './support';

// Design-check seed: signed-in user, blinca-demo cart (600+ kr), home address
// (deliverable). Local state only: nothing here reaches a backend.
test.beforeEach(async ({ page }) => {
	await open(page, '/checkout');
});

const radio = (page: import('@playwright/test').Page, label: string) =>
	page.getByRole('radio', { name: new RegExp('^' + esc(label)) });

test('delivery / pick-up toggle switches the step and the address section', async ({
	page
}, info) => {
	await expect(radio(page, tr(info, 'co.delivery'))).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByRole('heading', { name: tr(info, 'co.deliveryAddress') })).toBeVisible();
	await radio(page, tr(info, 'co.pickup')).click();
	await expect(radio(page, tr(info, 'co.pickup'))).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByRole('heading', { name: tr(info, 'co.pickupFrom') })).toBeVisible();
	await expect(page.getByRole('heading', { name: tr(info, 'co.pickupTime') })).toBeVisible();
	await radio(page, tr(info, 'co.delivery')).click();
	await expect(page.getByRole('heading', { name: tr(info, 'co.deliveryAddress') })).toBeVisible();
});

test('scheduling shows a slot picker; ASAP hides it', async ({ page }, info) => {
	const slots = page.getByRole('combobox', { name: tr(info, 'co.schedule') });
	await expect(slots).toHaveCount(0);
	await radio(page, tr(info, 'co.schedule')).click();
	await expect(slots).toBeVisible();
	expect(await slots.locator('option').count()).toBeGreaterThan(1);
	await expect(slots.locator('option:checked')).toHaveText(/\d\d:\d\d/);
	await radio(page, tr(info, 'co.asap')).click();
	await expect(slots).toHaveCount(0);
});

test('an invalid phone is flagged aria-invalid and blocks placing the order', async ({
	page
}, info) => {
	const phone = page.getByLabel(tr(info, 'co.phone'), { exact: true });
	const place = page.locator('.co-summary .btn-primary');
	await expect(place).toBeDisabled(); // no phone yet
	await phone.fill('12');
	await phone.blur();
	await expect(phone).toHaveAttribute('aria-invalid', 'true');
	await expect(place).toBeDisabled();
	await expect(page.locator('.co-summary .hint')).toHaveText(tr(info, 'co_phone_invalid'));
	await expect(page.locator('#co-phone-err')).toHaveText(tr(info, 'co_phone_invalid'));
	await phone.fill('70 123 45 67');
	await expect(phone).not.toHaveAttribute('aria-invalid', 'true');
	await expect(place).toBeEnabled();
});

test('the order note is capped at 300 characters', async ({ page }) => {
	const note = page.locator('#co-note');
	await expect(note).toHaveAttribute('maxlength', '300');
	await note.focus();
	await page.keyboard.insertText('x'.repeat(320));
	await expect(note).toHaveValue('x'.repeat(300));
});

// No counter is rendered next to the note (only maxlength), so a user gets no
// feedback when typing stops. Documents the expected behaviour.
test.fixme('the order note shows a 0/300 character counter', async ({ page }) => {
	await page.locator('#co-note').fill('hello');
	await expect(page.getByText('5/300')).toBeVisible();
});
