# Blinca customer website — Steps 0–6 verification (plus 8, 9)

Read-only check of branch `feat/customer-catalog-and-status` against the
Step 0–6 plan (Step 7 Mollie intentionally not done). Verified 2026-10-08
from real code and command output. Anything not checked this way is marked
"not verified".
Base for the boundary diff: merge-base with `main` = `09b559e`.

## Progress update — 2026-10-08 (Mollie + home)

Work landed after the Step 0–9 report above:

- **Step 7 Mollie — DONE (pay-in MVP).** New backend under
  `packages/backend/convex/customer/`: `mollieClient.ts` (typed fetch client,
  key only from `MOLLIE_API_KEY`, never logged; refuses `live_` without
  `MOLLIE_ALLOW_LIVE`), `payments.ts` (`start`/`sync`/`getStatus` +
  internal `applyPaymentOutcome`/`fetchAndApply`, idempotent, amount always
  from the order, status always re-fetched from Mollie, orders move to `new`
  only through the shared `applyPayment`), and `mollieHttp.ts` (webhook,
  answers 200 fast, re-fetches then applies; registered with one line in
  `http.ts`). Pay page + new `/orders/[id]/pay/return` page. Webhook URL is
  omitted on loopback dev (Mollie rejects it); `payments.sync` settles the
  return page instead. Tests: `test/unit/payments.test.ts`. See
  `docs/PAYMENTS.md`.
- **Checkout unblocked.** `CartLines` dead `checkoutReady` flag removed; the
  marketing bag's checkout no longer dead-ends.
- **Home is the real marketplace landing at `/`.** The signed-in home moved
  to `/` (rich layout — filter rail, banner, cuisine rail, real offers/promos,
  restaurant grid, popular-dishes rail), all on live Convex data; cards link
  to the real `/restaurants/[slug]` so add → cart → checkout → Mollie works.
  `/dashboard` 308-redirects to `/`. Login lands on `/`.
- **Orders / tracking page** built at `/orders` (was a stub), reached from a
  new Orders button beside the cart in the top bar.
- **Popular dishes** rail backed by a new public query
  `customer/home.ts:listFeaturedDishes` (simple, in-stock dishes across
  restaurants; quick-add to the real cart).
- **Deliverable test addresses.** `seed.ts` now ensures the demo restaurant
  has a delivery zone covering the seeded customer's saved postal codes.
- **Light theme is the default** (`tokens.css` no longer auto-follows OS dark;
  dark stays an explicit `data-theme` opt-in), per DESIGN.md.

Checks: backend `tsc` + `bun test test/unit/payments.test.ts` pass; customer
`check-types` passes (0/0); sv/en message parity maintained.

## Summary table

| Step                     | Verdict           | One-line reason                                                                                  |
| ------------------------ | ----------------- | ------------------------------------------------------------------------------------------------ |
| 0 audit + schema         | DONE              | Report exists with all sections; orders clash resolved to M2b canonical                          |
| 1 read layer             | DONE              | list/getBySlug(null-if-inactive)/getForRestaurant/getItem + unions; whitelist projection         |
| 2 guards + status timing | DONE              | Guard codes, 404 load, one-timer skew-corrected client helper                                    |
| 3 badges + gallery       | DONE              | All components exist and are used; gallery dev-gated, noindex, off-sitemap                       |
| 4 restaurant page        | DONE              | Sticky pinned panel, modal, JSON-LD from real fields, real-data cards                            |
| 5 cart                   | DONE              | Tables/indexes match design; ownership checks; live repricing; drawer + /cart + replay + confirm |
| 6 checkout               | DONE              | preview + placeOrder via M2b helpers; idempotency; /checkout; pay stub labelled                  |
| 7 Mollie                 | DONE (pay-in MVP) | mollieClient + payments actions + webhook + pay/return pages; see progress update above          |
| 8 order tracking         | PARTIAL           | Timeline/toasts/delays built + unit-tested; live-transition e2e skipped; no history page         |
| 9 i18n/tests/polish      | PARTIAL           | Parity 492/492, axe on 3 flows, 320px covered; gaps listed below                                 |

## Boundary check — CLEAN (with noted exceptions)

`git diff main...HEAD --name-only`, excluding `apps/customer/` and
`packages/backend/convex/customer/`, yields only:
`README.md` (docs), `bun.lock` (+axe, +convex-test entries only),
`packages/backend/convex/_generated/api.d.ts` (new customer/* module
registrations only), `packages/backend/convex/schema.ts` (see below),
`packages/backend/package.json` (+`convex-test@^0.0.60` devDep only),
`packages/backend/test/unit/*.test.ts` (new test files only).

No changes in `apps/partner`, `apps/admin`, `apps/courier`, authz
wrappers, auth config, `crons.ts`, or any existing partner function/
query/mutation. `git status` before this report was clean.

### schema.ts diff (full) — purely additive

```diff
 import { hoursRangeValidator } from "./lib/storeValidators";
+import { cartTables } from "./customer/cartSchema";
@@
   }).index("by_active", ["isActive"]),
+
+  // Step 5 customer carts (see customer/cartSchema.ts). Spread last so no
+  // existing table or index moves.
+  ...cartTables,
 });
```

One import + one trailing spread. No table or index touched, none reordered.

## Rules scan (apps/customer)

- `$lib` imports: none. `$env/*`: none. `$app/environment`: none.
  (`$app/env` and `$app/env/public` used correctly throughout.)
- Raw hex in components: two real hits —
  1. `src/lib/components/order/OrderStatusToast.svelte:64-65`
     (`var(--blinca-ink, #1c1416)`, `color: #fff`; should be bare tokens).
  2. `src/routes/(app)/(protected)/orders/[orderId]/+page.svelte:166,210-211,214`
     (`var(--mist, #f6eeea)` etc.; `--mist` does not exist — only
     `--blinca-mist` — so the raw-hex fallback is live, not dead).
     (Token files, brand SVGs and dark-theme token definitions excluded.)
- Hardcoded visible strings in new components: none found (spot-checked
  `CartLines`, `OrderTimeline`, checkout page; all copy via `m.*`; one
  typographic quote pair around a variable only).
- One-weight violations: `account/+page.svelte:19` and `signup/+page.svelte:48`
  use `font-semibold`; `home/RestaurantSheet.svelte:172` uses `<b>`;
  `orders/[orderId]/+page.svelte` `.terminal h2` sets `font-weight: 500`.
- Markers: no TODO/FIXME/XXX/HACK. One honest historical comment in
  `cartAdapter.ts:7` ("was a Step 4 stub"). No `console.log` in src.
- Secrets: no Mollie/test/live keys, no `api_key`/`secret` values in branch
  history for apps/customer or packages/backend. Only doc mentions of
  Mollie and a labelled pay stub.

## i18n parity

`sv.json` 492 keys, `en.json` 492 keys. Zero keys missing on either side.
15 identical strings, all legitimate (loanwords: Pizza/Sushi/Thai/Vegan/
Kebab/Fika/Press/Blinca Go; "System"; "Status:"; pure placeholders
`{minutes} min`, `+{minutes} min`, `{name} – Blinca`). One dev-only nit:
`dev_status_banners` is `"Banners"` in sv too.

## Test results (actually run)

| Suite                                                   | Result                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| backend `tsc --noEmit`                                  | PASS                                                                                                                              |
| backend `bun test test/unit` (16 files)                 | **176 pass / 0 fail** (new: cart 18, checkout 22, customerProjection 6, customerStatus 25, orderGuard 14, orderTracking 4)        |
| customer `check-types` (svelte-check)                   | PASS, 0 errors 0 warnings                                                                                                         |
| customer `lint` (prettier + eslint)                     | PASS                                                                                                                              |
| customer `vitest --run` (14 files)                      | **111 pass / 0 fail** (incl. timeline 8, cartHelpers/cartText/fingerprint/pricePreview, MenuItemRow spec, CartLines spec)         |
| Playwright `status.e2e` (no backend needed)             | **7 pass** (run live just now)                                                                                                    |
| Playwright `seo.e2e`                                    | **16 pass** (run live just now)                                                                                                   |
| Playwright `console-clean`                              | 6 pass / **2 fail — environmental only** (`/login`, `/signup` need Convex: 503 get-session + WS refused, no backend running here) |
| Playwright `restaurant.e2e`                             | fails without backend — needs manual check                                                                                        |
| Playwright `cart/checkout/dashboard/...` (auth + seeds) | need deployment — needs manual check                                                                                              |
| `vite build` (production, Cloudflare adapter)           | PASS; route chunks ≤84 kB (gzip ≤25 kB); `/dev/*` present only as server entries (404 at runtime via `dev` flag), not prerendered |

## Per-step evidence and gaps

### Step 0 — DONE

`apps/customer/docs/CUSTOMER_AUDIT.md` exists with plan summaries (§3),
schema clash table (§5), shared-logic map (§6), gap list (§7) and recommended
order (§10). Orders clash resolved by adopting the M2b canonical tables
(`awaiting_payment/new/accepted/ready/picked_up/rejected/cancelled`,
object address, `estimatedReadyAt`); audit §5 + §10 state the merge already
did this and `schema.ts` on this branch confirms it. Gaps: none for this step.

### Step 1 — DONE

`customer/restaurants.ts`: `list` (line 64), `getBySlug` returns null for
unknown/inactive (lines 132–141). `customer/menu.ts`: `getForRestaurant`
(141), `getItem` (192). `statusTypes.ts`: `RestaurantStatus` (6 kinds),
`ItemAvailability` (5 kinds), `RestaurantTiming`, `canOrderNow/Later`.
`catalog.ts` re-exports query refs + inferred types, no second union.
`projection.ts` whitelists public fields (comment lines 3–4 name the
excluded partner/internal fields). Tests: `customerStatus.test.ts` (25),
`customerProjection.test.ts` (6). Gaps: none found (DST/midnight/special-
day/paused/stock-reset coverage claimed by tests — files assert it; full
content not re-read line by line).

### Step 2 — DONE

`orderGuard.ts`: `restaurantOrderError`, `scheduledOrderError`,
`itemOrderError`, `assertRestaurantCanOrder` (102), `assertItemOrderable`
(138); codes RESTAURANT_CLOSED/PAUSED, SCHEDULED_TIME_OUTSIDE_HOURS,
ITEM_SOLD_OUT. `+page.server.ts` 404s on null with `no-store`.
`useRestaurantStatus.svelte.ts`: exactly one `setTimeout` (line 59, no
`setInterval`), skew offset from `serverNow` (49–50), visibility re-sync
with cleanup (74–77), SSR-safe. Live `useQuery` subscription in the page.
Tests: `useRestaurantStatus.svelte.test.ts`, `compute.test.ts`,
`orderGuard.test.ts` (14). Gaps: none.

### Step 3 — DONE

Components exist: `RestaurantStatusBadge`, `RestaurantStatusBanner`,
`ItemAvailabilityBadge`, `AvailabilityOverlay`, `addToCartState(.test)`,
`statusMocks`. Used with real data in: restaurant page, `MenuItemRow`,
`ItemModal`, shared `RestaurantCard` (status variant), `CartLines`,
banner on cart/checkout. `/dev/status`: `prerender=false` + `if (!dev)
error(404)` (`+page.server.ts`), `noindex` via `Seo` (page line 45),
excluded from sitemap (not in `publicRoutes`; `/dev/` in robots
`privatePrefixes`), mock data in a clearly named module. Contrast pairs
documented as comments (stone/mist 5.0:1, ink/saffron 9.9:1). Gallery e2e
7/7 passing (ran just now), screenshots committed for 320/1280 only.
Gaps: contrast values are asserted in comments, not measured in CI (axe
runs cover pages, not the gallery specifically — gallery has no axe test).

### Step 4 — DONE

Pinned panel verified in real CSS: desktop `position: sticky; top:
calc(var(--rest-sticky-top) + 16px); height: calc(100dvh - …)` (page lines
311–313); mobile cover `position: sticky; top: var(--rest-sticky-top);
height: 36dvh` behind the sheet (468–471); no `background-attachment`
anywhere in src. `restaurant-detail.e2e.ts` asserts the panel/cover do not
move on desktop + mobile, chips/keyboard/Enter, modal min/max + live totals,
Escape/focus-return/scroll-lock, 404, no-JS name+menu+JSON-LD, sv/en,
axe on page + modal, 320/390/768/1280 screenshots. `ItemModal` uses native
`<dialog>` + `showModal`, min/max enforcement, display-only `pricePreview`
totals with "server re-validates" comment. JSON-LD `restaurant()` emits
only optional-when-present fields + hours specs. Real data: dashboard uses
Step 1 `catalog.listRestaurants` with status variant linking to
`/restaurants/[slug]`; marketing home + `SiteHeader` + `home/*` still use
the clearly named mock module (by design: prerendered showcase). Cart
adapter is real (delegates to the live store; sessionStorage park +
login redirect fallback). Gaps: (a) screenshots for steps 4–6 exist only
as e2e outputs, none committed; (b) `home/*` mock scope is intentional but
undocumented in code — only README describes it.

### Step 5 — DONE

Tables match the design: `carts{customerId, restaurantId,
fulfillment?, scheduledFor?, postalCode?, createdAt, updatedAt,
expiresAt, pendingOrderId?, pendingFingerprint?}` idx `by_customer`;
`cartItems{cartId, menuItemId, variantId?, optionIds[], quantity, note?,
createdAt, updatedAt}` idx `by_cart`. One cart per customer (lookup by
`by_customer`, replace-cart flow), one restaurant per cart
(`CART_OTHER_RESTAURANT` + name). Every function loads the cart and checks
`cart.customerId` → NOT_FOUND (cart.ts:155-156, 558, 643). Repricing via
shared `buildLine`/`loadMenuSnapshot` at read time; no prices or names
stored (only ids/quantity/note). Limits enforced: qty 1–99
(`QUANTITY_INVALID`), 50 lines (`CART_FULL`), note 200 chars
(`NOTE_TOO_LONG`). Expiry 7d + lazy-absent in `get`; `pruneExpired`
(internalMutation) exists and `crons.ts` is untouched (empty diff —
someone must still schedule it, e.g. daily). UI: header badge
(`CartButton`, badge hidden at 0, `aria-live` count), drawer (desktop
right / mobile sheet), `/cart` page sharing `CartLines`, logged-out park +
replay (`blinca-pending-cart`), native confirm dialog with focus handling.
Tests: 18 convex-test + oj unit specs; cross-customer NOT_FOUND covered.
Gaps: none structural.

### Step 6 — DONE

`checkout.preview` + `placeOrder` exist; no second orders table (only
`db.patch` on carts + `insertAwaitingPaymentOrder`). Revalidation: Step 2
guards + same preview logic; client sends no amounts (fee/totals recomputed;
menu price-move covered by test). Fingerprint mirrored both sides
(`canonicalFingerprintInput` + FNV-1a in `checkout.ts:167-187` and
`cart/fingerprint.ts:37-57`); idempotency returns same order on match;
differing fingerprint supersedes via status patch + `logEvent`
(`checkout.ts:698-722`, owner-decided, `cancelReason: "superseded"`);
`ORDER_LIMIT` 5. `/checkout` (protected → login `?next=`): pill
delivery/pickup from real switches, saved-or-inline address with zone
verdict, ASAP/scheduled with 15-min Stockholm slots from `preview.slots`,
phone + note with labels/autocomplete/inputmode, 300 ms debounced preview
keeping stale values, alert region + first-invalid focus, fingerprint on
submit. Button wording states the obligation: "Beställ och betala" /
"Place order and pay". Pay stub at `/orders/[orderId]/pay` labelled
"STUB for Step 7", owner-checked via `orders.getMine` (NOT_FOUND for
others, null for missing). Tests: 22 convex-test incl. DST/midnight slots,
happy paths, idempotency, limit, isolation; Playwright full path incl.
postal-not-served, focus, keyboard-only, axe, 320/390/1280 shots.
Gaps: see fix list (checkoutReady dead flag vs contradicting e2e pair).

### Step 7 — NOT INTEGRATED (expected, not a failure)

No Mollie keys/code in the branch (history grep clean). `pay/+page.svelte`
is a labelled stub showing number/items/total/`awaiting payment` from
`orders.getMine`. Nothing calls `applyPayment` from customer code (only
dev simulator + tests per audit).

### Step 8 — PARTIAL

Verified: `/orders/[orderId]` localized route, owner-checked `getTimeline`
(NOT_FOUND for others, actor ids stripped), live `useQuery` subscription,
timeline from `orderEvents` (`OrderTimeline`, `OrderUpdates`), delay
`+5/+10/+15` parsed from `delayed` events with running-late banner from
real `estimatedReadyAt`, in-app toasts via `latestStatus` signal in the
protected shell (fires on change only, never first load), reduced motion

- tabular numbers + Stockholm 24h times, unit tests (timeline 8,
  orderTracking 4). Schema statuses
  (`awaiting_payment/new/accepted/ready/picked_up/rejected/cancelled`) all
  handled in UI; `preparing`/`completed`/`delivered` are display-only steps
  (no `delivered` in schema or UI — post-pickup has no tracking step);
  `auto_rejected` surfaces via event feed + refund message. Simulator
  (`devOrders.ts`) is `devToolsEnabled()`-gated internal-only — cannot run
  in production. Seed provides `accepted` + `picked_up` orders, so tracking
  renders without Mollie. Gaps: (a) live-transition e2e SKIPPED (needs a
  partner action; no harness); (b) NO order history page — `/orders` is still
  `ComingSoon` (only dashboard "order again" row); (c) no axe test on the
  tracking page/modal; (d) `new` unreachable without payment/simulator/DB
  edit.

### Step 9 — PARTIAL

- Locales: cookie strategy, no URL routing (unchanged from audit). sv
  default, en second on all new pages (spot-checked checkout, tracking,
  cart, pay stub); key parity 492/492; prices `sv-SE` ("129 kr" style);
  Stockholm 24h times everywhere checked.
- E2E coverage: closed-blocks-ordering (checkout.e2e env-gated
  CLOSED_MENU_SLUG + guard unit tests) partial; paused short/long/
  indefinite render in gallery + backend tests, blocking path partial;
  sold-out via MenuItemRow browser spec; outside-schedule rendered in
  gallery; add/quantity/conflict(dialog env-gated SECOND_MENU_SLUG)/replay,
  delivery+pickup+scheduled, postal-not-served, keyboard-only, delay display
  via unit tests — covered or env-gated. Below-minimum: backend unit only,
  no e2e. Delay live message: no e2e (skipped).
- Quality: axe on cart, checkout, restaurant-detail flows (not tracking,
  dashboard, home); 320px no-scroll tests in cart/checkout/dashboard/
  login-ui/restaurant-detail/status; console-clean passes except
  login/signup without backend (environmental); focus rings + 44px targets
  present on new controls (spot-checked); 404 + error pages covered by
  seo/console-clean e2e; empty/loading states present (dashboard, cart,
  checkout skeletons, timeline skeleton); SEO basics verified live
  (title/desc/canonical/hreflang/noindex-outside-production/JSON-LD/
  sitemap-with-slugs + graceful no-backend fallback).
- Performance: build passes; largest route chunks 84 kB (24.9 kB gzip);
  images lazy except hero/modal; no per-second timers (only 5.5 s marketing
  carousel interval, pre-existing).
- Docs: root README + `apps/customer/README.md` updated (env vars, seeds,
  test login, how to run suites, TRUSTED_ORIGINS); known stubs named
  (pay stub, ComingSoon pages).

## Cross-cutting findings

- Mock data: only the prerendered marketing home (`(marketing)/+page`,
  `SiteHeader`, `home/*` components) uses `lib/mock/*` — clearly named
  and intentional. Everything behind auth or on restaurant/cart/checkout/
  orders routes uses live Convex data.
- Language switch: cookie-based `LanguageMenu`/`LanguageToggle` on every
  new page (verified imports); no `/en` routing by design.
- Risks before Steps 8/9 follow-ups: (1) no path to status `new` without
  Mollie/simulator/DB edit — tracking of fresh orders untestable live;
  (2) no customer `orderEvents` subscription beyond `getTimeline`
  (sufficient, read-only); (3) seed covers accepted/picked_up only;
  (4) `pruneExpired` unscheduled — carts table grows until someone
  registers it.
- Partner side impact: additive `cartTables` spread (no table/index moved),
  new customer-only modules, hand-synced `api.d.ts` (codegen-equivalent;
  safe to overwrite with `convex codegen`). Nothing partner-facing changed.

## Fix list

Must fix:

1. `CartLines.svelte:39` — `const checkoutReady = false` is dead: the
   checkout link is permanently `aria-disabled` with `preventDefault`.
   Flip to `true` (or delete the flag). This contradicts
   `checkout.e2e.ts:60` (clicks it expecting `/checkout`).
2. `cart.e2e.ts:69` — test "checkout stays inert until Step 6" asserts the
   pre-Step-6 behavior and contradicts the checkout.e2e full-path test.
   Rename/rewrite to assert navigation.
3. `OrderStatusToast.svelte:64-65` — raw hex fallbacks; use bare
   `var(--blinca-ink)` / `var(--blinca-white)`.
4. `orders/[orderId]/+page.svelte:166,210-211,214` — `--mist` is not a
   defined token (only `--blinca-mist`), so raw-hex fallbacks are live;
   fix names and drop hex. Same file `.terminal h2` sets
   `font-weight: 500` (one-weight rule).
5. `OrderAgainRow.svelte:36` — links to dead `/restaurant/{id}` stub;
   point at `/restaurants/[slug]`.
6. `account/+page.svelte:19`, `signup/+page.svelte:48`
   (`font-semibold`), `home/RestaurantSheet.svelte:172` (`<b>`) — one-weight
   violations.
7. No order history page (`/orders` is ComingSoon) — build or drop the route.
8. `order-tracking.e2e.ts` live-transition test is a skip placeholder —
   needs a partner-action harness or documented manual run.
9. `dev_status_banners` is English in sv.json (dev-only, trivial).
10. `CLOSED_MENU_SLUG` / `SECOND_MENU_SLUG` e2e tests always skip — seed a
    closed-with-menu and second-menu restaurant, or accept the gap.

Should fix: schedule `pruneExpired`; axe on tracking + dashboard pages;
below-minimum and delay-message e2e; `dev_status` gallery axe run.
Nice to have: commit screenshots for steps 4–6 flows; document the
`home/*` mock-scope decision in code, not just README.

## Mollie readiness (for Step 7)

- Helpers present: `applyPayment` (`orderWrite.ts:198`, idempotent
  `awaiting_payment → new`, assigns `dailyNumber`, schedules auto-reject)
  and `requestRefund` (`:57`, records `requested` only — no executing
  worker).
- Orders already carry `molliePaymentId` (+ `by_molliePaymentId` index),
  `paymentStatus`, `paidAt`.
- `CONVEX_SITE_URL` + `PUBLIC_SITE_URL` wired (`site.ts`, `env.ts`).
- One shared-file edit needed: a webhook line in `http.ts` (currently only
  auth routes), e.g. `http.route({ path: "/mollie/webhook", method: "POST",
handler: <new module> })`, with the handler calling `applyPayment`.
- Still needed: create-payment action, webhook handler + signature check,
  refund-executing worker, redirect/return pages, receipt/email channel
  (none exists), and replacing the pay stub.

## Manual checks for the owner

Backend-dependent flows could not run here (no deployment; do not start
one without checking who shares it). With dev + seeded backend running:

1. Sign in as `user@blinca.test`, open a seeded open restaurant, add
   Mineralvatten, watch the header count go 0 → 1.
2. Change quantity to 2 (subtotal doubles), remove the line (empty state).
3. Sign out, add an item, confirm redirect to `/login?next=…`, sign in,
   confirm the item replays once.
4. Cart has demo food → open a second restaurant with a menu → confirm
   the "Start a new cart?" dialog shows the current name; Replace and Keep.
5. `/cart` → checkout link works (covers fix #1); `/checkout` shows fee,
   15-min Stockholm slots, ASAP enabled; place with pickup + phone →
   lands on `/orders/[id]/pay` stub with number/items/total.
6. Postal `99999` → "levererar inte" + submit blocked; empty phone →
   focus lands in the phone field.
7. Closed restaurant page: banner + inert schedule button; paused page:
   paused reason; sold-out dish row: overlay + disabled add with reason.
8. Switch sv ↔ en on restaurant, cart, checkout, tracking pages; confirm
   prices stay "129 kr"-style and times 24-hour.
9. 320 px width on the same pages: no horizontal scroll.
10. Partner-advance an order (accept → delay +10 → ready → hand over) and
    watch the timeline, late banner, toast and updates list flip live.
