/* Phone header LangMenu (Header.svelte), at a 390px viewport. CSS hides it at
   <=760px in the real app (app.css:668), so the behaviour is tested here. */
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';

// Spy mode keeps the real runtime and wraps its exports in spies. A factory
// that spreads importOriginal() crashes Vitest's browser mocker on Windows
// paths with spaces ("Blinca Backend"), so none of these tests use one.
vi.mock('#lib/paraglide/runtime.js', { spy: true });

import LangMenu from './LangMenu.svelte';
import { getLocale, setLocale } from '#lib/paraglide/runtime.js';

beforeAll(() => page.viewport(390, 844));
// The real setLocale reloads the page; the test only checks the call.
beforeEach(() => vi.mocked(setLocale).mockReset().mockImplementation(() => {}));

const pill = () => page.getByRole('button', { expanded: false }).or(page.getByRole('button', { expanded: true }));
const menu = () => document.querySelector('.lang-menu') as HTMLElement;

test('opens on click and lists both languages', async () => {
	render(LangMenu);
	expect(menu().hidden).toBe(true);
	await pill().click();
	expect(menu().hidden).toBe(false);
	await expect.element(page.getByRole('menuitemradio', { name: /English/ })).toBeVisible();
	await expect.element(page.getByRole('menuitemradio', { name: /Svenska/ })).toBeVisible();
	expect(document.querySelector('[aria-checked=true]')!.textContent).toContain(getLocale() === 'en' ? 'English' : 'Svenska');
});

test('Escape closes the menu and returns focus to the button', async () => {
	render(LangMenu);
	await pill().click();
	(page.getByRole('menuitemradio').first().element() as HTMLElement).focus();
	await userEvent.keyboard('{Escape}');
	expect(menu().hidden).toBe(true);
	expect(document.activeElement).toBe(pill().element());
});

test('selecting the other language switches the locale and closes the menu', async () => {
	render(LangMenu);
	const other = getLocale() === 'en' ? 'sv' : 'en';
	await pill().click();
	await page.getByRole('menuitemradio', { name: other === 'sv' ? /Svenska/ : /English/ }).click();
	expect(setLocale).toHaveBeenCalledWith(other);
	expect(menu().hidden).toBe(true);
});
