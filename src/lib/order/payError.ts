import { m } from '#lib/paraglide/messages.js';

/** Localised, actionable text for a `payments.start` failure code (never the raw backend string). */
export function payErrorText(code: string): string {
	switch (code) {
		case 'ORDER_NOT_PAYABLE':
			return m.pay_error_order_not_payable();
		case 'ORDER_EXPIRED':
			return m.pay_error_order_expired();
		case 'NOT_FOUND':
			return m.pay_error_not_found();
		default:
			return m.pay_error_generic();
	}
}
