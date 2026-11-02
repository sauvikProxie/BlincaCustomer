/*
 * Accepted, intentional differences between the source design and the customer app.
 * Applied to the CUSTOMER run only (never the source), as CSS that neutralises one
 * deliberate product change each, so the rest of the page is still compared pixel
 * for pixel. Rules (MIGRATION.md, "Design-match exceptions"):
 *   - one entry per change, element- or token-level, never a page region or a section;
 *   - every entry says what changed, why it is intended, the commit, and the test that
 *     checks the intended behaviour (so the mask never hides a regression entirely);
 *   - a pair passes only when it is identical after these entries; `--raw` shows the
 *     differences without them. `selector` (optional) is counted per page, and an entry
 *     that matches nothing in any shot is reported as stale.
 *   - `routes` limits an entry to the named routes; `srcCss`/`srcSelector` apply to the source run.
 *   - `dropRule` removes one rule from the customer's stylesheets (matched by a substring
 *     of its selector text), restoring the source behaviour for that rule exactly.
 */
export const MASKS = [
	{
		id: 'green-token',
		what: '--green #2E7D4F -> #2A7449 (success text, open pills, progress and step fills, including the tracking steps)',
		why: 'WCAG AA contrast for the .veg tag (green on green-bg: 4.44 -> 5.00); deliberate',
		commit: '7c5c270',
		coveredBy:
			'e2e/mocked/design-exceptions.e2e.ts (--green value and contrast), e2e/mocked/contrast.e2e.ts (axe)',
		css: ':root{--green:#2E7D4F!important}'
	},
	{
		id: 'link-text-brand-dark',
		what: 'Small brand-red links (.btn-link, .back-link, footer .ftr-min a) use --brand-dark #B3212F instead of --brand #E23744',
		why: 'Small text needs 4.5:1; #E23744 is 4.08-4.32 on white and the page background, #B3212F is 6.26-6.61 (audit A03)',
		commit: 'bc4cb40',
		coveredBy:
			'e2e/mocked/contrast.e2e.ts (axe color-contrast on login, home, account, restaurant, info), e2e/mocked/design-exceptions.e2e.ts (computed colour)',
		selector: '.btn-link:not(.muted), .back-link, .ftr-min a',
		css: '.btn-link:not(.muted),.back-link,.ftr-min a{color:var(--brand)!important}'
	},
	{
		id: 'tabbar-label-brand-dark',
		what: 'The active label in the phone tab bar (11px) uses --brand-dark; its icon keeps --brand',
		why: 'Small text needs 4.5:1 (audit A03)',
		commit: 'bc4cb40',
		coveredBy:
			'e2e/mocked/contrast.e2e.ts (axe color-contrast on home and account at 390px), e2e/mocked/design-exceptions.e2e.ts (computed colour)',
		selector: '.tabbar .is-here > span',
		css: '.tabbar .is-here > span{color:var(--brand)!important}'
	},
	{
		id: 'phone-language-pill',
		what: 'The language pill (globe + code) stays in the header on phones, and the address chip shrinks to make room',
		why: 'Phone users had no language switch (audit); added in the customer app, absent from the source',
		commit: 'cffaa4b',
		coveredBy: 'e2e/mocked/lang-menu.e2e.ts (pill visible on phones, 44px, menu works)',
		selector: '.hdr .lang-wrap',
		css: '@media (max-width:760px){.hdr .lang-wrap{display:none!important}}'
	},
	{
		id: 'mobile-field-16px',
		what: 'Text fields (.field, header .search input, .pill-search input, .promo-input, textarea, select) are 16px on screens up to 1024px wide; the source uses 14.5-15px',
		why: 'Below 16px iOS Safari zooms the page when a field is focused (audit A10); deliberate',
		commit: 'cffaa4b',
		coveredBy: 'e2e/mocked/design-exceptions.e2e.ts (16px up to 1024, 15px above)',
		dropRule: '.pill-search input, .promo-input, textarea, select'
	},
	{
		id: 'open-card-pill-anchor',
		what: 'On the "open now" restaurant card the pill and ETA time sit inside the photo box, so they are positioned relative to the photo',
		why: 'The source positioned them against the whole card and they landed on top of the title; a deliberate layout fix',
		commit: 'cffaa4b',
		coveredBy: 'e2e/mocked/design-exceptions.e2e.ts (pill and time inside the photo box)',
		selector: '.all-open-media',
		css: '.all-open-media{position:static!important}'
	},
	{
		id: 'track-back-button-44',
		what: 'The back button on the tracking map is 44x44 px (source: 40x40)',
		why: 'Minimum tap target (audit A08); deliberate',
		commit: 'cffaa4b',
		coveredBy: 'e2e/mocked/design-exceptions.e2e.ts (back button at least 44x44)',
		selector: '.map-back',
		css: '.map-back{width:40px!important;height:40px!important}'
	},
	{
		id: 'track-restaurant-pin',
		what: 'The restaurant marker on the tracking map is a plain brand pin; the source draws a circle with the restaurant initial',
		why: 'Product decision on the live map ("a plain pin, not the old letter badge"), carried to the design-check map',
		commit: '917fdaf',
		coveredBy: 'e2e/mocked/design-exceptions.e2e.ts (restaurant marker is a pin, no letter)',
		selector: '.rest-pin',
		css: '.rest-pin{visibility:hidden!important}',
		srcSelector: 'svg.map-svg g:has(> text)',
		srcCss: 'svg.map-svg g:has(> text){visibility:hidden!important}'
	},
	{
		id: 'login-no-site-header',
		what: 'The site header is not shown on the login, signup and forgot-password pages',
		why: 'Product decision: auth pages are a focused flow without site navigation',
		commit: '7968890',
		coveredBy: 'e2e/mocked/design-exceptions.e2e.ts (no site header on /login)',
		routes: ['login'],
		srcSelector: 'header#site-header, .island-wrap',
		srcCss: 'header#site-header, .island-wrap{display:none!important}'
	},
	{
		id: 'account-receipt-button',
		what: 'Each order row on the account page has a Receipt button (opens the receipt modal / PDF)',
		why: 'New feature: customers can get a receipt; absent from the source',
		commit: '6aef8da',
		coveredBy: 'e2e/mocked/design-exceptions.e2e.ts (Receipt button opens the receipt modal)',
		routes: ['account'],
		selector: '.receipt-btn',
		css: '.receipt-btn{display:none!important}'
	},
	{
		id: 'account-address-actions',
		what: 'Each saved address row has Edit and Delete icon buttons beside the tile',
		why: 'New feature: saved addresses can be edited and deleted; absent from the source',
		commit: '7728453',
		coveredBy: 'e2e/mocked/addresses.e2e.ts (edit and delete); e2e/mocked/design-exceptions.e2e.ts',
		routes: ['account'],
		selector: '.addr-row > .icon-btn',
		css: '.addr-row > .icon-btn{display:none!important}'
	},
	{
		id: 'account-demo-card',
		what: 'The "Demo data / Reset demo data" card is removed from the account page',
		why: 'Product decision: no demo tooling in production (P2-8)',
		commit: 'bafd522',
		coveredBy: 'e2e/mocked/design-exceptions.e2e.ts (no demo card or reset button)',
		routes: ['account'],
		srcSelector: 'section.card:has(+ .m-logout)',
		srcCss: 'section.card:has(+ .m-logout){display:none!important}'
	}
];
