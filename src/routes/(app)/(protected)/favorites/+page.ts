import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Favourites live in the account's tabbed view now. */
export const load: PageLoad = () => {
	redirect(308, '/account?tab=favourites');
};
