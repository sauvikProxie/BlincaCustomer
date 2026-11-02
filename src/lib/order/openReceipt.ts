/**
 * Receipt entry point shared by tracking, the orders list and account.
 * Opens the receipt modal; the modal loads `getMine` + `getStatus` and
 * offers Download PDF (primary) + Print. New file — no transplanted UI
 * module is touched for this.
 */
import { openModal } from '#lib/layers.svelte.js';
import ReceiptModal from '#lib/components/ReceiptModal.svelte';
import { m } from '#lib/paraglide/messages.js';

/** @param {string} orderId Convex order id (String(order._id)). */
export function openReceipt(orderId: string): void {
	if (!orderId) return;
	openModal(ReceiptModal, { orderId }, { label: m.nui_receipt(), className: 'modal-sm modal-pad' });
}
