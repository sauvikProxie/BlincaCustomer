import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** The home lives at `/`; keep old /dashboard links/bookmarks working. */
export const load: PageLoad = () => {
	redirect(308, '/');
};
