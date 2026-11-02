import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/**
 * The cart is a drawer on the home now. `?cart=open` tells the shell to open it
 * (and then strips the parameter). Keeps old /cart links and bookmarks working.
 */
export const load: PageLoad = () => {
	redirect(308, '/?cart=open');
};
