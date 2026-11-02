import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	CONVEX_SITE_URL: {
		description: 'Convex HTTP actions URL Better Auth is hosted on',
		schema: (input) => input ?? 'http://127.0.0.1:3211'
	},
	PUBLIC_CONVEX_URL: {
		description: 'Convex deployment URL used by the browser client',
		public: true,
		static: true
	},
	PUBLIC_SITE_URL: {
		description: 'Absolute origin the site is served from, used for canonicals and JSON-LD',
		public: true,
		static: true,
		schema: (input) => input ?? 'https://blinca.se'
	},
	PUBLIC_APP_NAME: {
		description: 'App name shown in the UI',
		public: true,
		static: true
	},
	CSP_IMG_HOSTS: {
		description:
			'Extra image origins for the Content-Security-Policy-Report-Only header, space separated (e.g. a seed image host). Convex storage is already allowed.',
		schema: (input) => input ?? ''
	},
	CSP_FORM_ACTION_HOSTS: {
		description:
			'Origins a form or redirect may navigate to after checkout (Mollie hosted checkout), space separated.',
		schema: (input) => input ?? 'https://www.mollie.com'
	},
	PUBLIC_MAPBOX_ACCESS_TOKEN: {
		description:
			'Mapbox default public token for the address picker and order-tracking map. Empty disables those maps.',
		public: true,
		static: true,
		schema: (input) => input ?? ''
	}
});
