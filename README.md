# @blinca/customer

Customer marketplace and ordering site: a SvelteKit app on the Cloudflare
Workers adapter, with a public marketing site, Better Auth + Convex signed-in
app, and the SEO/performance groundwork described below.

It uses the official **Blinca design** (see `docs/design/DESIGN.md`): the flat
Blinca palette and brand-kit logos, self-hosted Figtree, pill buttons, 16/24px
cards and sheets, and a Saffron focus ring. The home page (`/`) is a
frontend-only marketplace built on mock data, and the signed-in app shares the
same tokens and components. Light theme only for now (dark mode is kept as
plumbing but the toggle is hidden — DESIGN.md §11).

```bash
bun run dev            # http://localhost:5173
bun run check-types
bun run lint
bun run test:unit --run
bun run test:e2e       # runs Playwright against whatever's at CUSTOMER_BASE_URL

bun run build           # production build — also fails if it ships a sourcemap
bun run preview          # wrangler dev against the built Worker, http://localhost:4173
bun run verify:no-sourcemaps  # just the sourcemap check, against an existing build
```

Building requires **Node 22+** (`wrangler types`/`wrangler dev` refuse Node
20 with a version-check error). If your default `node` is older, install one
with `nvm install 22` and either `nvm use 22` first or prefix just these
commands, e.g. `PATH="$(dirname $(nvm which 22)):$PATH" bun run build`.

`bun run test:e2e` expects the Convex backend and this dev server to already
be running, plus the seeded test customer and marketplace fixtures:

```bash
cd packages/backend && bun run dev             # terminal 1
cd apps/customer    && bun run dev             # terminal 2
cd packages/backend && bun run seed:customer   # the test account
cd packages/backend && bun run seed:marketplace # restaurants, promos, orders
```

Both seeds are idempotent and refuse to run against a non-local deployment.
`seed:marketplace` must run after `seed:customer` — it attaches the addresses,
favourites and orders to that account.

## Test login

| Email              | Password      |
| ------------------ | ------------- |
| `user@blinca.test` | `password123` |

Created by `seed:customer` (local deployments only). Use it at
`http://localhost:5173/login`.

### Login fails with "Something went wrong"

Almost always the address, not the credentials. Better Auth only accepts
sign-in from origins in the Convex `TRUSTED_ORIGINS` env var; anything else is
rejected with a 403 `INVALID_ORIGIN` (the login page shows a specific
"Sign-in isn't allowed from this web address" message for it).

- Use `http://localhost:5173`. `http://127.0.0.1:5173` cannot connect — the dev
  server binds IPv6 only.
- The production preview (`bun run preview`, port 4173) works only once its
  origin is trusted:

  ```bash
  cd packages/backend
  npx convex env set TRUSTED_ORIGINS http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173
  ```

- More than 3 attempts in 10 seconds trips the rate limiter, which shows a
  separate "too many attempts" message.

## SEO values still needed

`src/lib/site.ts` is the single source of truth for identity data. These
fields are deliberately absent — nothing is ever filled in with a guess, and
every consumer (JSON-LD, footer, /kontakt) omits what is missing:

| Field       | Used by                                                           |
| ----------- | ----------------------------------------------------------------- |
| `email`     | Organization `contactPoint`, the /kontakt mailto link, the footer |
| `phone`     | Organization `contactPoint`, a `tel:` link                        |
| `sameAs`    | Organization social profiles                                      |
| `legalName` | Organization `legalName`                                          |

Set them in `site.ts` and they appear everywhere at once. `address` stays
unset on purpose: Blinca has no walk-in premises, so the graph uses
`Organization` with `areaServed: Sweden` rather than `LocalBusiness`, and no
`PostalAddress` or `GeoCoordinates` is published.

`WebSite.potentialAction` (SearchAction) is also omitted — there is no public
search URL yet. Add one to `src/lib/seo/jsonld.ts` once `/restauranger` exists.

## Brand and SEO assets

```bash
bun run images:brand   # favicon.ico, PWA icons, og-default.png from the brand kit
bun run images:food    # responsive AVIF/WebP/JPEG for the home-page demo photos
bun run images:hero    # hero variants, once the dish photo is added
```

All use ImageMagick (already installed); no image dependency is in the project.

- `images:brand` regenerates the favicons/PWA icons from
  `logo/02-App-Icon/blinca-app-icon-square-1024.png` and `og-default.png`
  (1200×630) from the white lockup on a Cranberry field. Logos are only
  trimmed, scaled and placed — never redrawn or recoloured. The brand lockup
  and mark SVGs the app imports live in `src/lib/assets/brand/`.
- `images:food` converts the Unsplash demo photos the home page uses into
  `static/food/` (two widths, AVIF + WebP + a JPEG fallback). Source photos
  come from the design zip's `website/img/`; set `BLINCA_PHOTO_SRC` to point
  elsewhere. Credits are kept in `static/food/CREDITS.txt` and shown in the
  home footer ("Matbilder från Unsplash"). These are placeholder content.

## Routes

| Route                                                                            | Group               | Prerendered? | Notes                                                                                 |
| -------------------------------------------------------------------------------- | ------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `/`                                                                              | `(marketing)`       | Yes          | Marketplace home — frontend-only, mock data (`src/lib/mock/`), prerendered + hydrated |
| `/sa-fungerar-det`, `/om-oss`, `/kontakt`                                        | `(marketing)`       | Yes          | Real content; built to static HTML, served straight from Cloudflare's asset layer     |
| `/forgot-password`                                                               | —                   | Yes          | Static placeholder, no session check                                                  |
| `/login`, `/signup`                                                              | `(app)`             | No           | Session-dependent redirect; needs SSR                                                 |
| `/dashboard`, `/account`, `/search`, `/orders`, `/favorites`, `/restaurant/[id]` | `(app)/(protected)` | No           | Signed-in app, needs SSR + Convex                                                     |

The `(app)` group's `+layout.svelte` is the **only** place that calls
`createPlatformAuth()` (Convex client + Better Auth client). The root layout
and `(marketing)` layout do not import it, directly or transitively — that
boundary is what keeps convex-svelte and better-auth off the marketing
pages' JS. Keep new signed-in-only code inside `(app)`; anything the
marketing pages import gets pulled into their bundle too.

**Known trade-off:** prerendered pages are served by Cloudflare's static
asset layer, which does not run `hooks.server.ts`. The language toggle on
the 4 marketing pages therefore cannot re-render them server-side — clicking
"English" sets the cookie (so the next dynamic page, e.g. `/login`, opens in
English) but the current static page stays Swedish. This is a deliberate
trade-off for the performance win; see the PR / task report for the full
reasoning. Fixing it properly means URL-based locale routing
(`/en/om-oss`, …), a bigger follow-up, not done here.

## Styling and i18n

- Design tokens live in `src/lib/styles/tokens.css` (the Blinca palette under
  constant `--blinca-*` tokens plus the existing semantic aliases),
  `fonts.css` (self-hosted Figtree `@font-face`) and `blinca.css` (flat control
  primitives: `bl-btn`, `bl-chip`, links, focus, `.sr-only`, one-weight base).
  `controls.css` holds the `tactile-*` recipes used by the signed-in app and
  auth pages — now **flat** (the skeuomorphic shadows/gradients/grain are
  gone), so those screens render the Blinca look without a per-component
  rewrite. Components reference tokens only; all of these move to `packages/ui`
  unchanged.
- **Light theme only** (DESIGN.md §11). The `data-theme` plumbing and the
  pre-paint script in `src/app.html` are kept, but the theme toggle is hidden
  from the UI; `--blinca-*` tokens stay constant across themes so branded
  surfaces are theme-proof.
- Home-page components live in `src/lib/components/home/`; the restaurant card
  is shared with the dashboard via `src/lib/components/shared/RestaurantCard`.
  `src/lib/mock/` holds the typed mock data and the Svelte 5 rune stores
  (locale, order mode, filters, favourites, bag, sheet, toast) — a Convex
  query can replace it later without touching the components.
- Copy lives in `messages/sv.json` and `messages/en.json`. Paraglide compiles
  them to `src/lib/paraglide/` (generated, git-ignored) on dev and build.
  Locale resolution is cookie → `Accept-Language` → `sv` (making Swedish the
  guaranteed default and adding English URL routes is a follow-up).

## Performance and production safety

- **JS budget**: the marketing pages carry no Convex and no Better Auth — just
  the Svelte + SvelteKit runtime plus route code (the `(app)` layout is the
  only place `createPlatformAuth()` loads). The home page is an interactive
  marketplace so its route chunk is larger than the static content pages;
  verify with a production build — the `<head>` of
  `.svelte-kit/cloudflare/index.html` lists every script/style it loads.
- **No sourcemaps**: `vite.config.ts` sets `build.sourcemap: false` and
  `bun run build` runs `scripts/check-no-sourcemaps.mjs` afterwards, which
  fails the build if `.svelte-kit/cloudflare` contains any `.map` file or
  `sourceMappingURL` comment.
- **Headers**: `_headers` (project root — **not** `static/`, which the
  adapter refuses) sets security headers for every response and sensible
  caching for the unhashed static images/icons. Cloudflare appends its own
  immutable-cache rule for `/_app/immutable/*` underneath it at build time.
  No Content-Security-Policy yet — see the task report for what it would
  need (inline theme script, inline JSON-LD, Convex's WebSocket origin) and
  why it wasn't rushed in.
- **Images**: brand logos are inline/`<img>` SVG lockups and marks from
  `src/lib/assets/brand/` (vector, no raster scaling). Home-page food photos
  go through `Photo.svelte` as responsive AVIF/WebP with a JPEG fallback and a
  reserved aspect ratio (no layout shift); only the first banner image is
  eager (`fetchpriority="high"`), everything else is lazy. Regenerate with
  `bun run images:brand` and `bun run images:food`.
- **Fonts**: **Figtree**, self-hosted from `static/fonts/` (latin +
  latin-ext woff2, `font-display: swap`, the latin file preloaded). The stack
  is `"Mundial", "Figtree", system-ui, sans-serif`, so dropping in a licensed
  Mundial is a one-block change in `src/lib/styles/fonts.css`. The supplied
  Mundial is the Fontspring **demo** (no commercial licence, missing å ä ö)
  and is **not** shipped — see `logo/03-Fonts/README.txt` and DESIGN.md §3.
- **Console cleanliness**: `e2e/console-clean.e2e.ts` loads every public page
  and fails on any console error/warning, uncaught exception, or failed
  (≥400) network request. Run it against both dev and the production preview
  — Svelte's dev-mode checks (a11y hints, etc.) are compiled out of
  production and so only show up under `vite dev`:
  ```bash
  bunx playwright test e2e/console-clean.e2e.ts --no-deps
  CUSTOMER_BASE_URL=http://localhost:4173 bunx playwright test e2e/console-clean.e2e.ts --no-deps
  ```

When M3 starts, extract the partner app's auth helpers into `packages/auth`
and its components into `packages/ui` instead of copying them here. See
`docs/IMPLEMENTATION_STATUS.md` at the repo root.
