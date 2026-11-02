/*
 * Dialog focus trap. Modal/Drawer focus the panel itself when no [autofocus]
 * child exists, and Tab from that panel used to walk out into the page behind
 * (Shift+Tab always did). Wrapping must happen inside the panel's focusables,
 * and focus that has escaped the panel must be pulled back in.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { layers, toast, toastError, toastState } from './layers.svelte.js';

let panel: HTMLElement;
let outside: HTMLButtonElement;

function dom(id: string): HTMLButtonElement {
	return panel.querySelector('#' + id) as HTMLButtonElement;
}

function tab(shiftKey = false): KeyboardEvent {
	const e = new KeyboardEvent('keydown', {
		key: 'Tab',
		shiftKey,
		bubbles: true,
		cancelable: true
	});
	document.dispatchEvent(e);
	return e;
}

beforeEach(() => {
	outside = document.createElement('button');
	document.body.appendChild(outside);
	panel = document.createElement('div');
	panel.tabIndex = -1;
	panel.innerHTML = '<button id="a">a</button><button id="b">b</button>';
	document.body.appendChild(panel);
	layers.push({
		id: 9001,
		kind: 'modal',
		component: null,
		props: {},
		side: 'right',
		label: '',
		className: '',
		closing: false,
		node: panel,
		lastFocus: null
	});
});

afterEach(() => {
	layers.splice(0, layers.length);
	panel.remove();
	outside.remove();
});

describe('layer focus trap', () => {
	test('Tab from the panel goes to its first focusable, Shift+Tab to the last', () => {
		panel.focus();
		expect(document.activeElement).toBe(panel);

		const fwd = tab();
		expect(fwd.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(dom('a'));

		panel.focus();
		const back = tab(true);
		expect(back.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(dom('b'));
	});

	test('wraps at both ends and pulls escaped focus back inside', () => {
		dom('a').focus();
		tab(true);
		expect(document.activeElement).toBe(dom('b'));

		tab();
		expect(document.activeElement).toBe(dom('a'));

		outside.focus();
		tab();
		expect(document.activeElement).toBe(dom('a'));
	});
});

describe('toast tone', () => {
	test('failures use the error tone and a plain toast resets it', () => {
		toastError('Nope');
		expect(toastState).toMatchObject({ msg: 'Nope', tone: 'error', action: null });
		toast('Done');
		expect(toastState).toMatchObject({ msg: 'Done', tone: 'ok' });
	});
});
