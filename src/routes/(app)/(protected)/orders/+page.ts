import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageLoad} */
export const load = () => redirect(308, '/account?tab=orders');
