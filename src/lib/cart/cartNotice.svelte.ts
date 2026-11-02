/**
 * The Step 4 stand-in for cart feedback. Step 5 owns the real cart; until
 * then this carries a single notice the page renders as a toast. Nothing is
 * stored anywhere — that is the whole point of this file for now.
 */
let messageKey = $state<string | null>(null);
let nonce = $state(0);

export function showCartNotice(key: string): void {
	messageKey = key;
	nonce += 1;
}

export function dismissCartNotice(key: string | null): void {
	if (key === null || key === messageKey) messageKey = null;
}

export const cartNotice = {
	get key() {
		return messageKey;
	},
	get nonce() {
		return nonce;
	}
};
