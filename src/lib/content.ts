import { m } from '#lib/paraglide/messages.js';
import type { Locale } from '#lib/paraglide/runtime.js';

/** Paraglide message option for rendering in an explicit locale (home page). */
export type LocaleOption = { locale?: Locale };

/**
 * Structure of the public marketing pages in one place: nav items, the "så
 * fungerar det" steps, the benefit cards and the footer.
 *
 * The strings themselves live in messages/{sv,en}.json — Paraglide was
 * already set up for the signed-in app, so this module holds the shape and
 * the message functions rather than a second copy of the copy.
 */

export type NavItem = {
	href: string;
	/** Accepts an optional `{ locale }` so the home page can render instantly. */
	label: (options?: LocaleOption) => string;
};

export const primaryNav: readonly NavItem[] = [
	{ href: '/', label: (o) => m.site_nav_home({}, o) },
	{ href: '/sa-fungerar-det', label: (o) => m.site_nav_how({}, o) },
	{ href: '/om-oss', label: (o) => m.site_nav_about({}, o) },
	{ href: '/kontakt', label: (o) => m.site_nav_contact({}, o) }
];

/** Routes the header's account buttons point at. Both pages already exist. */
export const authRoutes = {
	login: '/login',
	signup: '/signup'
} as const;

export type IconName = 'choose' | 'order' | 'receive';

export type Step = {
	icon: IconName;
	title: () => string;
	body: () => string;
};

export const steps: readonly Step[] = [
	{ icon: 'choose', title: m.home_step1_title, body: m.home_step1_body },
	{ icon: 'order', title: m.home_step2_title, body: m.home_step2_body },
	{ icon: 'receive', title: m.home_step3_title, body: m.home_step3_body }
];

/**
 * Real contact details, once supplied. Both are intentionally null: the
 * /kontakt page renders only what exists here, so nothing is ever invented.
 * Fill these in and the page picks them up with no other change.
 */
export const contact: {
	email: string | null;
	phone: { display: string; href: string } | null;
} = {
	email: null,
	phone: null
};
