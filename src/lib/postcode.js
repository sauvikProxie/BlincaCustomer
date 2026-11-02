/* Swedish postcodes: send five digits, show "113 31". */
import { normalizePostalCode } from './cart/fingerprint.ts';

/** Five digits to send to the backend, or null when it is not a valid postcode.
 *  @param {string | null | undefined} raw @returns {string | null} */
export function postcodeDigits(raw) {
	return normalizePostalCode(String(raw ?? ''));
}

/** "11331" / "113 31" → "113 31"; anything else is shown as typed.
 *  @param {string | null | undefined} raw @returns {string} */
export function formatPostcode(raw) {
	const d = postcodeDigits(raw);
	return d ? `${d.slice(0, 3)} ${d.slice(3)}` : String(raw ?? '');
}

/** A delivery address the backend can take: has a normalisable postcode.
 *  @param {{ zip?: string } | null | undefined} addr */
export function hasValidPostcode(addr) {
	return !!addr && postcodeDigits(addr.zip) !== null;
}

/** "Drottninggatan 1, 113 31 Stockholm"; missing parts are left out.
 *  @param {string | null | undefined} street @param {string | null | undefined} postalCode
 *  @param {string | null | undefined} city @returns {string} */
export function addressLine(street, postalCode, city) {
	const place = [postalCode ? formatPostcode(postalCode) : '', city ?? '']
		.filter(Boolean)
		.join(' ');
	return [street ?? '', place].filter(Boolean).join(', ');
}
