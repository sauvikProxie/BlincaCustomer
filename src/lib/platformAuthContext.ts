import { getContext, setContext } from 'svelte';
import type { PlatformAuth } from '@blinca/auth';

const KEY = 'platformAuth';

export function setPlatformAuthContext(value: PlatformAuth) {
	setContext(KEY, value);
}

export function usePlatformAuth(): PlatformAuth {
	return getContext(KEY);
}
