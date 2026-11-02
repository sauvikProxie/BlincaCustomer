import { browser } from '$app/env';

const STORAGE_KEY = 'blinca-address';

/** Reads the remembered address id. Storage can throw — null is the fallback. */
function readStored(): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

/**
 * Which saved address the marketplace is filtered by. Only the id is
 * persisted; the address itself always comes from Convex, so an edited or
 * deleted address can never go stale in the UI.
 */
export function createAddressSelection() {
	let selectedId = $state<string | null>(readStored());

	return {
		get selectedId() {
			return selectedId;
		},
		select(id: string) {
			selectedId = id;
			if (!browser) return;
			try {
				localStorage.setItem(STORAGE_KEY, id);
			} catch {
				// The choice just won't survive a reload.
			}
		}
	};
}
