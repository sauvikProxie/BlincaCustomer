import { redirect } from '@sveltejs/kit';
import { getServerSession } from '@blinca/auth/server';
import { CONVEX_SITE_URL } from '$app/env/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ request, url }) => {
	// Design-check (dev only): no backend/auth — render the protected pages with
	// the source's sample data so Playwright can pixel-compare against the source.
	if (import.meta.env.DEV && import.meta.env.VITE_DESIGN_CHECK) return { user: null };

	const session = await getServerSession(request, {
		convexSiteUrl: CONVEX_SITE_URL
	});

	// Signed-out visitors and any other account type go to login with no
	// explanation. `next` sends a
	// signed-out visitor back to the page they asked for once they log in.
	const next = `/login?next=${encodeURIComponent(url.pathname + url.search)}`;
	if (session?.user.accountType !== 'customer') redirect(303, next);
	return { user: session.user };
};
