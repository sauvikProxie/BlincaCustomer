import { redirect } from '@sveltejs/kit';
import { getServerSession } from '@blinca/auth/server';
import { CONVEX_SITE_URL } from '$app/env/private';
import { safeNext } from '#lib/safeNext.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	const session = await getServerSession(request, { convexSiteUrl: CONVEX_SITE_URL });
	// A customer who is already signed in has nothing to do here.
	if (session?.user.accountType === 'customer') redirect(303, next);
	return { next };
};
