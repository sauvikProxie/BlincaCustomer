import { getContext, setContext } from 'svelte';
import type { createAddressSelection } from '#lib/addressSelection.svelte.js';

type AddressSelection = ReturnType<typeof createAddressSelection>;

const KEY = 'addressSelection';

export function setAddressSelectionContext(value: AddressSelection) {
	setContext(KEY, value);
}

export function useAddressSelection(): AddressSelection {
	return getContext(KEY);
}
