/**
 * Client mirror of the server fingerprint (packages/backend/convex/customer/
 * checkout.ts). Byte-identical canonicalization (sorted keys, sorted option
 * ids, nulls never undefined) and FNV-1a hex — pinned by the SAME test
 * vector on both sides, so a match always means identical order intent.
 */
export type FingerprintInput = {
	lines: {
		menuItemId: string;
		variantId?: string | null;
		optionIds: string[];
		quantity: number;
		note?: string | null;
	}[];
	fulfillment: string;
	address:
		| { kind: 'id'; id: string }
		| { kind: 'fields'; street: string; postalCode: string; city: string }
		| null;
	scheduledFor?: number;
	promoCode?: string;
};

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value !== null && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		return Object.fromEntries(
			Object.keys(record)
				.sort()
				.map((k) => [k, sortKeys(record[k])])
		);
	}
	return value;
}

export function canonicalFingerprintInput(input: FingerprintInput): string {
	const normalized = {
		address: input.address,
		fulfillment: input.fulfillment,
		lines: input.lines
			.map((line) => ({
				menuItemId: line.menuItemId,
				note: line.note ?? null,
				optionIds: [...line.optionIds].sort(),
				quantity: line.quantity,
				variantId: line.variantId ?? null
			}))
			.sort((a, b) => (a.menuItemId < b.menuItemId ? -1 : a.menuItemId > b.menuItemId ? 1 : 0)),
		promoCode: input.promoCode ?? null,
		scheduledFor: input.scheduledFor ?? null
	};
	return JSON.stringify(sortKeys(normalized));
}

export function fingerprint(input: FingerprintInput): string {
	const text = canonicalFingerprintInput(input);
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Swedish postal code: strip spaces, then exactly 5 digits. */
export function normalizePostalCode(postalCode: string): string | null {
	const digits = postalCode.replace(/\s/g, '');
	return /^\d{5}$/.test(digits) ? digits : null;
}
