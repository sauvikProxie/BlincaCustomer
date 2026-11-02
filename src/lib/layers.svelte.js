/* Blinca – overlay layers (modals, drawers) + toast.
   Replaces the imperative openDrawer/openModal/toast API from components.js.
   Content is real Svelte components (never HTML strings); the only {@html}
   in the app is the icon set. Focus trap, Esc and scroll-lock match legacy. */
import { browser } from '#app/env';

/** @type {Array<{ id: number, kind: 'modal' | 'drawer', component: any, props: any, side: string, label: string, className: string, closing: boolean, node?: HTMLElement | null, lastFocus?: HTMLElement | null, onClose?: () => void }>} */
export const layers = $state([]);

/** @type {{ msg: string, seq: number, tone: 'ok' | 'error', action: { label: string, onClick: () => void } | null }} */
export const toastState = $state({ msg: '', seq: 0, tone: 'ok', action: null });

let nextId = 1;
const EXIT_MS = 240;

function lockScroll() {
	if (browser) document.body.classList.add('no-scroll');
}

function unlockScroll() {
	if (browser && !layers.some((l) => !l.closing)) document.body.classList.remove('no-scroll');
}

/**
 * @param {'modal'|'drawer'} kind
 * @param {any} component
 * @param {any} [props]
 * @param {{ side?: string, label?: string, className?: string, onClose?: () => void }} [opts]
 */
function push(kind, component, props, opts = {}) {
	const layer = {
		id: nextId++,
		kind,
		component,
		props: { ...(props || {}) },
		side: opts.side || 'right',
		label: opts.label || '',
		className: opts.className || '',
		closing: false,
		node: null,
		lastFocus: browser ? /** @type {HTMLElement|null} */ (document.activeElement) : null,
		onClose: opts.onClose
	};
	layer.props.close = () => closeLayer(layer.id);
	layers.push(layer);
	lockScroll();
	return layer.id;
}

/**
 * @param {any} component
 * @param {any} [props]
 * @param {{ label?: string, className?: string, onClose?: () => void }} [opts]
 */
export function openModal(component, props = {}, opts = {}) {
	return push('modal', component, props, opts);
}

/**
 * @param {any} component
 * @param {any} [props]
 * @param {{ side?: string, label?: string, className?: string, onClose?: () => void }} [opts]
 */
export function openDrawer(component, props = {}, opts = {}) {
	return push('drawer', component, props, opts);
}

/** @param {number} id */
export function closeLayer(id) {
	const layer = layers.find((l) => l.id === id);
	if (!layer || layer.closing) return;
	layer.closing = true;
	unlockScroll();
	if (browser) {
		window.setTimeout(() => {
			const i = layers.indexOf(layer);
			if (i !== -1) layers.splice(i, 1);
			if (layer.onClose) layer.onClose();
			try {
				/** @type {HTMLElement|null} */ (layer.lastFocus)?.focus?.({ preventScroll: true });
			} catch {
				/* noop */
			}
		}, EXIT_MS);
	} else {
		const i = layers.indexOf(layer);
		if (i !== -1) layers.splice(i, 1);
	}
}

export function closeAll() {
	layers
		.filter((l) => !l.closing)
		.forEach((l) => closeLayer(l.id));
}

/** @param {string} msg @param {{ label: string, onClick: () => void } | null} [action] */
export function toast(msg, action = null) {
	toastState.msg = msg;
	toastState.action = action;
	toastState.tone = 'ok';
	toastState.seq++;
}

/** A failure message: announced assertively, shown longer, no success tick. */
/** @param {string} msg */
export function toastError(msg) {
	toastState.msg = msg;
	toastState.action = null;
	toastState.tone = 'error';
	toastState.seq++;
}

/* Global Esc + focus trap, exactly like the legacy document handler. */
if (browser) {
	document.addEventListener('keydown', (e) => {
		const open = layers.filter((l) => !l.closing);
		if (!open.length) return;
		const top = open[open.length - 1];
		if (e.key === 'Escape') {
			closeLayer(top.id);
			return;
		}
		if (e.key === 'Tab' && top.node) {
			const f = Array.prototype.filter.call(
				top.node.querySelectorAll(
					'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
				),
				(/** @param {Element} x */ x) => x.offsetParent !== null
			);
			if (!f.length) return;
			const first = f[0];
			const last = f[f.length - 1];
			const focused = document.activeElement;
			if (focused === top.node || !top.node.contains(focused)) {
				// Focus sits on the panel itself (no [autofocus] child) or has been
				// lost to the page behind: pull it back inside the dialog.
				e.preventDefault();
				(e.shiftKey ? last : first).focus();
			} else if (e.shiftKey && focused === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && focused === last) {
				e.preventDefault();
				first.focus();
			}
		}
	});
}
