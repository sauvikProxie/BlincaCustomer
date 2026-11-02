# Customer-side audit

> Read-only analysis of `apps/customer` and the Convex backend, written to plan the
> customer ordering flow (status logic, restaurant page, cart, checkout, Mollie,
> order tracking) without breaking the partner side. **Nothing in this audit changes
> code.** It records what exists on this branch today (post `customer-side → main`
> merge, commit `08e938a`) versus what the plans describe.
>
> Date: 2026-10-07. Branch: `main`.

---

## 1. Summary (10 lines)

1. **No M3 plan doc exists.** M3 lives only in `docs/IMPLEMENTATION_STATUS.md` §6–§7 and scope paragraphs of the two specs; the next agent was told to _write_ `docs/superpowers/plans/2026-10-xx-m3-customer-ordering.md` — it has not been written.
2. The backend already carries the **full M2b/M2c/M3-backend canonical schema** (orders, orderItems, orderItemOptions, orderEvents, refunds, counters, delivery zones, hours) — the merge already adopted M2b as source of truth.
3. The customer-side placeholder `orders`/`orderItems` tables were **already reconciled onto the canonical tables** during the merge; no schema clash remains on this branch.
4. Customer backend surface that exists and works: `marketplace.*`, `customer.orders.*`, `favorites.*`, `customers.getMe` — all `customerQuery`/`customerMutation`.
5. The authenticated **`/dashboard` is the only real Convex-wired customer page**; the marketing home `/` is 100% mock data.
6. **Restaurant detail, cart, checkout, orders list, order tracking, search, favorites pages are all `ComingSoon` stubs** (routes exist, no logic). There is **no checkout route/service and no real cart** anywhere.
7. The reusable pricing/validation math is **pure and importable** (`lib/orderBuilder.ts buildLine`, `lib/orderRules.ts`, `lib/menuRules.ts`, `lib/stockholmTime.ts`, `lib/restaurantStatus.ts`); snapshot loading and all writes are **Convex-only** (`lib/orderLoader.ts`, `lib/orderWrite.ts`).
8. The **payment boundary is wired but not called by any customer code**: `internal.orders.applyPaymentSucceeded` / `applyPayment` exist and are exercised only by the dev simulator and tests — no Mollie create-payment, webhook, or checkout mutation exists.
9. Auth is **fully working** (login/signup/sign-out, server-side customer-only guard); `forgot-password` is a non-functional prerendered placeholder.
10. i18n: **Swedish is the base locale**, cookie-driven switching via `LanguageToggle`; there is **no `/en` URL routing and no `reroute` hook** yet.

Questions needing answers are in §9.

---

## 2. Scope & method

- Read in full: the four plan docs (`2026-10-02-blinca-foundation`, `2026-10-05-m2a-partner-menu`, `2026-10-06-m2b-partner-orders`, `2026-10-06-m2c-partner-store`), both specs (`2026-10-02-blinca-design`, `2026-10-05-partner-menu-orders-design`), and `docs/IMPLEMENTATION_STATUS.md`.
- Inventoried every `packages/backend/convex/*.ts` module and `lib/*.ts` helper, and the full `apps/customer/src` tree.
- "Implemented vs planned" below is judged against the **real code on this branch**, not the plan text.
- Facts not found in the repo are marked **not found**. No fact here is invented.

---

## 3. Milestone summaries

### M3 planning material — does it exist?

**There is no dedicated M3 plan or spec file.** `docs/superpowers/plans/` contains only M0/M1, M2a, M2b, M2c. M3 material is scattered across:

| Location                                                        | What it holds                                                                                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `IMPLEMENTATION_STATUS.md` §7 "Next: M3"                        | The real handoff. "M2 is complete on `main`." Instructs the next agent to _author_ `docs/superpowers/plans/2026-10-xx-m3-customer-ordering.md` (**does not yet exist**). Lists hook points already in place. |
| `IMPLEMENTATION_STATUS.md` §6 "Deferred items"                  | Explicit M3 TODOs (see below).                                                                                                                                                                               |
| `specs/2026-10-02-blinca-design.md` §8, §10 (M3)                | Original high-level M3 scope: marketplace queries, signup/login, cart, checkout, `placeOrder`, Mollie create-payment + webhook + `applyPaymentOutcome`, emails/receipts, customer UI.                        |
| `specs/2026-10-05-partner-menu-orders-design.md` §1, §4.3, §4.4 | `orderBuilder` shared with M3; "M3 adds the Mollie worker"; Mollie + customer app named out of scope for M2.                                                                                                 |
| Git                                                             | `34da991` (payment boundary / auto-reject / dev simulator — the M2b hook code), `08e938a` (merge that landed the customer app + customer backend functions). Neither adds a plan doc.                        |

**Status doc still marks M3 "Not started"** even though the merge landed customer code.

### M0 / M1 — foundation (`2026-10-02-blinca-foundation.md`) — **executed**

- Tables: `restaurants`, `partnerProfiles`, `admins`, `customers`, `businessHours`, `specialDays` + Better Auth component tables (`user/session/account/verification/jwks/rateLimit`).
- Functions: `restaurants.getMyRestaurant/updateMyRestaurant`, `customers.getMe`, `admins.whoAmI`, `provisionPartner.run/runAdmin` (internal — **no public partner signup**), `seed.*`. Auth wrappers `partner|customer|admin Query/Mutation` in `lib/authz.ts`; permission map in `lib/permissions.ts`.
- Scope notes: `packages/auth`, `packages/ui`, `packages/config` **deferred until the customer app exists (M3)**. `accountType` is `input:false`, default `"customer"`.
- **Implemented:** yes, all of the above exist on this branch.

### M2a — partner menu (`2026-10-05-m2a-partner-menu.md`) — **done**

- Tables: `vatRates` (global), `menuSchedules`, `menuCategories`, `menuItems`, `menuItemVariants`, `optionGroups`, `options`, `menuItemOptionGroups` (all restaurant-scoped except `vatRates`). `menuItems`/variants/options carry `...stockFields` (`stockStatus`, `soldOutUntil?`) with a `by_stock` index.
- Functions (all partner-facing `menu:write`/`menu:stock`): `menuCategories.*`, `menuItems.*` (incl. `setVariants`, image upload), `menuSchedules.*`, `optionGroups.*`, `menuStock.setStock/availability/resetExpired`, `vatRates.list` (public `query`) + `seedDefaults`. `crons.ts` resets expired stock every 5 min.
- Scope notes: `packages/ui` deliberately **not** created ("customer-side branch uses its own design system"); "Do not touch `apps/customer`."
- **Implemented:** yes — all modules present.

### M2b — partner orders (`2026-10-06-m2b-partner-orders.md`) — **done**

- Tables: `orders`, `orderItems`, `orderItemOptions`, `orderEvents`, `refunds`, `counters`; `restaurants` gains `pausedUntil?`, `deliveryBufferMinutes?`. (Full field lists in schema; see §5.)
- Functions: `orders.board/get/accept/reject/delay/markReady/handOver/cancel` (partner), `orders.autoReject` + `orders.applyPaymentSucceeded` (internal), `restaurants.pauseOrders/resumeOrders/orderStatus`, `orderReports.history/salesSummary`, `devOrders.simulate/simulateForMe/inspect` (dev-gated). Pure helpers: `lib/orderBuilder.ts` (`buildLine`, shared with M3 checkout), `lib/orderRules.ts`, `lib/orderLoader.ts`, `lib/orderWrite.ts`.
- Scope notes: delivery-fee VAT **decided with Mollie in M3**; `awaiting_payment` orders are **never visible to partners** ("M3's checkout creates them"); refund execution deferred ("M3 adds the Mollie worker"); **"the `customer-side` branch's `orders`/`orderItems` must be migrated to this schema before that branch merges."**
- **Implemented:** yes, and the above migration note is now resolved (merge adopted these tables).

### M2c — partner store (`2026-10-06-m2c-partner-store.md`) — **done**

- Schema changes: `businessHours.isClosed` → optional/legacy; `specialDays` reshaped to `ranges: array({openMinutes,closeMinutes})`; `restaurants` gains `postalCode?`, `offersDelivery?`, `offersPickup?`, `coverImageStorageId?`; `menuImageUploads.isCover`; new `deliveryZones` table.
- Functions: `openingHours.get/setWeekly/upsertSpecialDay/removeSpecialDay` (`store:hours`), `deliveryZones.list/create/update/setActive/remove` (`store:write`), `restaurants.setCoverImage` + cover upload. Helpers: `lib/openingHours.ts` (`loadOpeningHours`, `isRestaurantOpenAt`), `lib/restaurantStatus.ts` (hours-aware `restaurantState`), `lib/stockholmTime.ts` gains `isOpenAt`/`isWithinOpeningHours`/`rangesForDate`, `lib/deliveryZones.ts` (`findZoneForPostalCode`, `activeZones`, `assertCodesFree`).
- Scope notes: every "is it open?" check (badge, simulator, **M3 checkout**) routes through one `isOpenAt`.
- **Implemented:** yes.

### M3 — customer app + ordering/payments — **partially present, no plan doc**

- `IMPLEMENTATION_STATUS.md` marks M3 **Not started**, but the merge landed: the customer SvelteKit app, and the customer backend functions (`marketplace`, `customer.orders`, `favorites`, `customers.getMe`, `seedCustomer`, `seedMarketplace`) plus the customer marketplace tables (`customerAddresses`, `favorites`, `promos`).
- **Still missing (the actual M3 ordering work):** cart tables/logic, checkout mutation (`placeOrder`), Mollie create-payment action, Mollie webhook `httpAction`, refund worker, receipts/emails, and all customer ordering UI (restaurant page → cart → checkout → tracking).
- §6 deferred-for-M3 TODOs (verbatim themes): Mollie refund worker; derive `deliveryFeeCents` from zones server-side; clamp stale webhook `paidAt`; cap name/address length; `isOpenAt` at `scheduledFor` for scheduled orders; "opens at" storefront helper (`nextOpeningAt` **not found**); keep unpaid orders hidden from partners if checkout expires them.

---

## 4. Current customer-side inventory (this branch)

### 4.1 Backend customer functions (exist, working)

| Function                           | Kind             | Purpose                                                                                                                                              |
| ---------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketplace.listRestaurants`      | customerQuery    | Grid; city/cuisine + quick filters (openNow, fastDelivery ≤30m, freeDelivery, topRated ≥4.5, vegetarian), open-first + rating sort, marks favorites. |
| `marketplace.listActivePromos`     | customerQuery    | Active banner promos by `sortOrder`.                                                                                                                 |
| `marketplace.listMyAddresses`      | customerQuery    | Saved delivery addresses, default first.                                                                                                             |
| `customer.orders.listActiveOrders` | customerQuery    | One in-flight order (statuses `awaiting_payment/new/accepted/ready`) as an OrderCard + items.                                                        |
| `customer.orders.listRecentOrders` | customerQuery    | Finished orders newest-first ("order again").                                                                                                        |
| `favorites.listMyFavorites`        | customerQuery    | Favourited active restaurants as cards.                                                                                                              |
| `favorites.toggleFavorite`         | customerMutation | Add/remove favourite; returns `{isFavorite}`.                                                                                                        |
| `customers.getMe`                  | customerQuery    | Signed-in customer profile.                                                                                                                          |

Seeds: `seedMarketplace.devSeedMarketplace` (internalMutation), `seedCustomer.devSeedCustomer` (internalAction).

### 4.2 Customer app (`apps/customer/src`)

| Area                                                    | State                                                                                                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing `/` (`(marketing)`)                           | Real UI, **100% mock** (`#lib/mock/*`), prerendered, public.                                                                                                               |
| `/dashboard` (`(protected)`)                            | **Real** — the only heavily Convex-wired page (6 queries + 1 mutation above).                                                                                              |
| `/account`                                              | Real but bare; hardcoded English strings (not Paraglide).                                                                                                                  |
| `/restaurant/[restaurantId]`                            | **Stub** (`<ComingSoon>`).                                                                                                                                                 |
| `/search`, `/orders`, `/orders/[orderId]`, `/favorites` | **Stubs** (`<ComingSoon>`).                                                                                                                                                |
| Cart                                                    | **No route.** Only `CartDrawer.svelte` stub + mock `bag` store. Shell hardcodes cart count `0` ("Cart is not built yet").                                                  |
| Checkout                                                | **Does not exist** (no route/component/service).                                                                                                                           |
| `/login`, `/signup`                                     | Real auth (`signIn.email` / `signUp.email`).                                                                                                                               |
| `/forgot-password`                                      | Prerendered placeholder, **not wired**.                                                                                                                                    |
| Auth guard                                              | `(app)/(protected)/+layout.server.ts` — redirects to `/login?next=` if no session or `accountType !== 'customer'`. Working.                                                |
| i18n                                                    | `baseLocale: "sv"`; `strategy: ['cookie','preferredLanguage','baseLocale']`; **no `/en` routing, no `reroute` hook**; switch via `LanguageToggle`/`LanguageMenu` (cookie). |
| Design tokens                                           | `src/lib/styles/{tokens.css,fonts.css,blinca.css,controls.css}` present; `--blinca-cranberry: #e23744` and the full ramp wired.                                            |

**Mock vs real:** marketing home runs on `mock/home.ts` + `mock/stores.svelte.ts` (the mock `bag`/`favourites`/`sheet`/`toast` runes — client-only, reset on reload). The dashboard and shell use live Convex. `addressSelection.svelte.ts` persists only the selected address **id** to `localStorage`; the address data comes from Convex.

---

## 5. Schema reconciliation (customer tables vs M2b/M2c canonical)

**Status: already reconciled during the merge.** The current `schema.ts` uses the **canonical M2b `orders`/`orderItems`** and the customer placeholder tables were migrated onto them. The table below records what the original `customer-side` branch had versus the canonical tables now on `main`, so the delta customer code must honour is explicit. (Preferred direction — adopt M2b as source of truth — is **safe and already done**.)

| Table                                      | Original `customer-side` fields                                                                                                  | Canonical (now on this branch)                                                                                                                                                                                                                                                                                                                    | Difference                                                                                                           | Resolution                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `orders` status                            | union `placed/accepted/preparing/picked_up/delivered/cancelled`                                                                  | `awaiting_payment/new/accepted/ready/picked_up/rejected/cancelled`                                                                                                                                                                                                                                                                                | Different lifecycle: customer had `placed/preparing/delivered`; canonical has `awaiting_payment/new/ready/rejected`. | **Adopt canonical.** `placed`→`new`, `preparing`→`ready` (approx), `delivered`→`picked_up`. Customer UI maps `new→accepted→ready→picked_up`. |
| `orders` fields                            | thin: `customerId, restaurantId, status, subtotalCents, deliveryFeeCents, totalCents, deliveryAddress: string, placedAt, etaAt?` | full lifecycle: adds `dailyNumber?, customerName, customerPhone?, fulfillment, deliveryAddress: object, scheduledFor?, customerNote?, discountCents, vatBreakdown[], paymentStatus, molliePaymentId?, paidAt?, acceptDeadline?, prepMinutes?, acceptedAt?, estimatedReadyAt?, readyAt?, pickedUpAt?, rejectedAt?, rejectReason?, cancelledAt?...` | Canonical is a superset + `deliveryAddress` is an **object** not a string; ETA is `estimatedReadyAt` not `etaAt`.    | **Adopt canonical.** Customer code reads `estimatedReadyAt` (mapped to `etaAt` in `listActiveOrders`'s return shape).                        |
| `orderItems`                               | `orderId, nameSv, nameEn?, quantity, unitPriceCents`                                                                             | `orderId, restaurantId, menuItemId?, variantId?, name, nameEn?, variantName?, variantNameEn?, unitPriceCents, vatBasisPoints, quantity, note?, lineTotalCents`                                                                                                                                                                                    | Canonical uses `name` (not `nameSv`); adds variant/vat/options/lineTotal.                                            | **Adopt canonical.** Customer mapper uses `name`; `listActiveOrders` returns `nameSv: item.name` for the existing UI prop.                   |
| `orderItemOptions`                         | not in customer branch                                                                                                           | full table (`optionId?, groupName, optionName, priceCents, quantity`)                                                                                                                                                                                                                                                                             | Canonical-only.                                                                                                      | Keep canonical.                                                                                                                              |
| `orderEvents`, `refunds`, `counters`       | not in customer branch                                                                                                           | present                                                                                                                                                                                                                                                                                                                                           | Canonical-only (partner lifecycle + refunds).                                                                        | Keep canonical.                                                                                                                              |
| `restaurants` card fields                  | `ratingAverage?, ratingCount?, priceLevel?, deliveryFeeCents?, deliveryMinutes?` + `by_city`                                     | same (merged in)                                                                                                                                                                                                                                                                                                                                  | None — customer fields merged into canonical row, all optional.                                                      | Done.                                                                                                                                        |
| `customerAddresses`, `favorites`, `promos` | present                                                                                                                          | present (identical)                                                                                                                                                                                                                                                                                                                               | None.                                                                                                                | Done.                                                                                                                                        |
| `businessHours`/`specialDays`              | customer branch had older required `isClosed` / scalar `open/closeMinutes`                                                       | M2c shape: `isClosed?` optional, `specialDays.ranges[]`                                                                                                                                                                                                                                                                                           | Customer branch was pre-M2c.                                                                                         | Canonical (M2c) wins; customer side never wrote these.                                                                                       |

**Is adopting M2b unsafe anywhere? No.** The customer placeholder tables were never in production and the merge already rewrote `customer.orders.ts`/`seedMarketplace.ts` to the canonical shape. The one ongoing cost: customer order queries must speak the canonical lifecycle (handled) and any future customer **write** path (checkout) must go through `lib/orderWrite.ts insertAwaitingPaymentOrder`, never insert `orders` directly.

---

## 6. Shared pure logic map (reuse, do not rewrite)

Classification: **PURE** = no `ctx`/db, no `_generated` import → safe to import from SvelteKit client **and** server. **Convex-only** = takes a `DatabaseReader`/`Writer` or imports `_generated`.

| Helper                                                                                  | File                      | Signature (abbreviated)                                                                     | Safe to import from                            |
| --------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `isOpenAt`                                                                              | `lib/stockholmTime.ts`    | `(restaurant: OpenFlags, hours: OpeningHours, ts: number) => boolean`                       | **client + server** (PURE)                     |
| `isWithinOpeningHours`                                                                  | `lib/stockholmTime.ts`    | `(hours: OpeningHours, ts: number) => boolean`                                              | **client + server** (PURE)                     |
| `rangesForDate`, `stockholmDate`, `dayOfWeekOf`, `businessDate`, `nextBusinessDayStart` | `lib/stockholmTime.ts`    | various, all pure                                                                           | **client + server** (PURE)                     |
| `restaurantState`                                                                       | `lib/restaurantStatus.ts` | `(input: OpenFlags & {hours: OpeningHours}, now: number) => "open" \| "paused" \| "closed"` | **client + server** (PURE)                     |
| `isSoldOut`                                                                             | `lib/menuRules.ts`        | `(stock: Stock, now: number) => boolean`                                                    | **client + server** (PURE)                     |
| `resolveStock`                                                                          | `lib/menuRules.ts`        | `(status: StockStatus, until: number\|undefined, now: number) => Stock`                     | **client + server** (PURE)                     |
| `buildLine`                                                                             | `lib/orderBuilder.ts`     | `(snapshot: MenuSnapshot, input: LineInput, now: number) => BuiltLine`                      | **client + server** (PURE; snapshot passed in) |
| `computeTotals`, `canTransition`, `assertTransition`, `scheduledReadyAt`                | `lib/orderRules.ts`       | pure                                                                                        | **client + server** (PURE)                     |
| `loadOpeningHours`                                                                      | `lib/openingHours.ts`     | `(db, restaurantId, fromDate) => Promise<OpeningHours>`                                     | **Convex only** (db)                           |
| `isRestaurantOpenAt`                                                                    | `lib/openingHours.ts`     | `(db, restaurant, ts) => Promise<boolean>`                                                  | **Convex only** (db)                           |
| `loadMenuSnapshot`                                                                      | `lib/orderLoader.ts`      | `(db, restaurantId, menuItemId) => Promise<MenuSnapshot>`                                   | **Convex only** (db)                           |
| `buildOrderLines`                                                                       | `lib/orderLoader.ts`      | `(db, restaurantId, inputs: LineInput[], now) => Promise<BuiltLine[]>`                      | **Convex only** (db; calls pure `buildLine`)   |
| `insertAwaitingPaymentOrder`                                                            | `lib/orderWrite.ts`       | `(db, args: NewOrderArgs) => Promise<Id<"orders">>`                                         | **Convex only** (writer)                       |
| `applyPayment`                                                                          | `lib/orderWrite.ts`       | `(ctx, args) => Promise<{alreadyApplied, dailyNumber}>`                                     | **Convex only** (writer)                       |
| `logEvent`, `requestRefund`, `nextDailyNumber`, `getPartnerOrder`                       | `lib/orderWrite.ts`       | various, db                                                                                 | **Convex only** (writer)                       |
| `findZoneForPostalCode`, `activeZones`                                                  | `lib/deliveryZones.ts`    | db                                                                                          | **Convex only** (db)                           |

**Key design the customer checkout must honour:** snapshot loading is Convex-only (`orderLoader.ts`), the **validation/pricing math is pure** (`buildLine`), and **`logEvent` in `orderWrite.ts` is the single writer of `orderEvents`**. A customer checkout mutation should call `insertAwaitingPaymentOrder` (which already loads snapshots, builds lines, computes totals, inserts order/items/options, logs `placed`) — not re-implement any of it.

---

## 7. Gaps by feature

### 7.1 Restaurant / menu / item statuses

- **Exists:** stock model (`stockFields`: `available/sold_out_today/sold_out_until/sold_out_indefinitely`), pure `isSoldOut`/`resolveStock`, `menuStock.availability` (partner), `by_stock` index, cron resetting expired stock. "Paused 30 min / long period" = `restaurants.pausedUntil` + `restaurantState()` returning `paused`. "Closed permanently" = `restaurants.isActive=false` → `restaurantState` `closed`. "Item temporarily unavailable" = stock `sold_out_*`.
- **Missing (customer):** no **public** per-restaurant menu read. `marketplace.listRestaurants` returns only card fields; there is **no customer query that returns a restaurant's menu** (categories/items/variants/options with resolved stock + open state). This is the biggest backend gap for the restaurant page. Source: M3 (spec §8, not yet planned).

### 7.2 Open / closed timing (server + client)

- **Exists:** pure `isOpenAt`/`isWithinOpeningHours`/`restaurantState` (importable both sides); db-backed `isRestaurantOpenAt`, `loadOpeningHours`. `listRestaurants` already computes `isOpen` server-side.
- **Missing:** a customer-facing restaurant query that returns opening hours + current state for the detail page; a **"opens at" / `nextOpeningAt`** helper (**not found** — listed as M3 deferred). SvelteKit client can import the pure helpers but needs the hours data shipped from a query.

### 7.3 Delivery delays & notifications (driver picked up, etc.)

- **Exists:** `orderEvents` with types `placed, paid, accepted, rejected, auto_rejected, delayed, ready, handed_over, cancelled, refund_requested`, written only by `orderWrite.logEvent`. Partner writes `accepted/delayed/ready/handed_over/cancelled`; system writes `paid/auto_rejected/refund_requested`. `delay` pushes `estimatedReadyAt`.
- **Missing:** **no courier/driver side** (M4) — there is no "driver picked up / out for delivery / delivered" event beyond `handed_over` (partner hands to courier). No customer notification channel (push/email/SMS) exists. Delivery tracking past `picked_up` is **not found**. Source: M4 (courier), with customer tracking UI in M3.

### 7.4 Restaurant details page

- **Exists:** route `/restaurant/[restaurantId]` as a `ComingSoon` stub; the shared `RestaurantCard` links to it.
- **Missing:** everything — the page, and the backend menu-read query it needs (§7.1). Source: M3.

### 7.5 New customer tables (cart, cartItems, notifications)

- **Missing entirely.** No `cart`, `cartItems`, or `notifications` tables exist. Current cart is the **mock `bag` rune** (client-only). Decision needed: server-persisted cart (new tables) vs client-only cart posted at checkout. Source: M3 (spec §5 lists cart; the customer-side branch explicitly deferred it).

### 7.6 Mollie payment pages

- **Exists (backend boundary only):** `insertAwaitingPaymentOrder` (creates `awaiting_payment`), `applyPayment` / `internal.orders.applyPaymentSucceeded` (idempotent `awaiting_payment → new`, schedules auto-reject), `refunds` table + `requestRefund`, `orders.molliePaymentId` + `by_molliePaymentId` index, `lib/trustedOrigins.ts` for redirect validation. These are only exercised by the **dev simulator** and tests.
- **Missing:** the Mollie **create-payment action**, the **webhook `httpAction`** that calls `applyPaymentSucceeded`, the **refund worker** that executes `requested` refunds and sets `paymentStatus: refunded`, the checkout mutation that calls `insertAwaitingPaymentOrder`, and all payment/redirect UI pages. Source: M3 (spec §8; deferred list §6).

---

## 8. What exists vs missing — one-glance

| Capability                     | Backend                                                         | Customer UI                              |
| ------------------------------ | --------------------------------------------------------------- | ---------------------------------------- |
| Marketplace grid               | ✅ `listRestaurants`                                            | ✅ dashboard                             |
| Promos / addresses / favorites | ✅                                                              | ✅ dashboard (favorites page stub)       |
| Active order + history read    | ✅ `customer.orders.*`                                          | ⚠️ card on dashboard; `/orders*` stubbed |
| Restaurant menu read (public)  | ❌ **missing**                                                  | ❌ stub                                  |
| Cart                           | ❌ no tables                                                    | ❌ mock only                             |
| Checkout / placeOrder          | ⚠️ `insertAwaitingPaymentOrder` exists, no customer entry point | ❌ none                                  |
| Mollie create/webhook/refund   | ⚠️ boundary only (`applyPayment`)                               | ❌ none                                  |
| Order tracking (live)          | ⚠️ `listActiveOrders` + `orderEvents`                           | ❌ stub                                  |
| Auth                           | ✅                                                              | ✅ (forgot-password placeholder)         |
| i18n sv default                | ✅ baseLocale sv                                                | ⚠️ no `/en` routing                      |

---

## 9. Risks & open questions

1. **No M3 plan doc.** Should we author `docs/superpowers/plans/2026-10-xx-m3-customer-ordering.md` first (per §7 handoff), or proceed feature-by-feature? The status doc still says M3 "Not started" despite merged code — do we update it?
2. **Public menu read query** does not exist and is the gating dependency for the restaurant page, cart, and checkout. Confirm it belongs to us (customer side) to add in `packages/backend` — note this touches backend, which was previously off-limits. **What is the ownership rule now for adding new customer backend functions/tables?**
3. **Cart model:** server-persisted (`cart`/`cartItems` tables) or client-only cart submitted at checkout? Affects schema and offline/multi-device behaviour.
4. **Checkout path:** confirm customer checkout must call `insertAwaitingPaymentOrder` (not insert `orders` directly) and that delivery fee is priced server-side via `findZoneForPostalCode` (per §6 deferred).
5. **Mollie:** which Mollie integration (hosted checkout redirect?), where do the API keys live, and is there a sandbox we can wire the webhook `httpAction` against?
6. **Order tracking past `picked_up`:** courier/delivery events are M4 and not built. For M3, is customer tracking limited to `new→accepted→ready→picked_up`, or do we need a placeholder "on its way/delivered" step now?
7. **Notifications:** is any customer notification (email receipt, push) in M3 scope, or deferred? No channel exists today.
8. **`/en` routing + translation audit** (from the earlier language task) — in scope for this work or separate? `/account`, signup, forgot-password still have hardcoded English.
9. **`forgot-password`** is a non-functional placeholder — in scope to wire now?
10. **Turborepo:** any change to `turbo.json`/pipeline must first follow `AGENTS.md` (resolve the local `turbo` package and read its bundled `docs/`). No such change is proposed in this audit.

---

## 10. Recommended order of work

1. **Decisions first (no code):** answer §9 Q1–Q7. Author the M3 plan doc (or a lighter customer-ordering plan) so the schema additions (menu-read query, cart model) are agreed before writing them.
2. **Public restaurant + menu read query** in `packages/backend` (`marketplace.getRestaurant` + a menu-read returning categories/items/variants/options with resolved stock via pure `isSoldOut`, and opening state via `restaurantState`). Unblocks the restaurant page.
3. **Restaurant detail page** (`/restaurant/[restaurantId]`) consuming that query; reuse pure `isOpenAt`/`isSoldOut`/`restaurantState` on the client.
4. **Cart** (per the §9 Q3 decision) — store + add-to-cart, replacing the mock `bag`.
5. **Checkout mutation** calling `insertAwaitingPaymentOrder`, with server-side delivery-fee pricing via `findZoneForPostalCode` and open-at validation.
6. **Mollie**: create-payment action + webhook `httpAction` → `applyPaymentSucceeded`; redirect/return pages; then the refund worker.
7. **Order tracking** (`/orders`, `/orders/[orderId]`) off `listActiveOrders` + `orderEvents`; wire the live `aria-live` status already in `ActiveOrderCard`.
8. **Polish:** search, favorites page, `/account` + signup i18n, `forgot-password`, and the `/en` routing / translation audit if in scope.

> Throughout, treat `lib/orderBuilder.ts`, `lib/orderRules.ts`, `lib/menuRules.ts`, `lib/stockholmTime.ts`, `lib/restaurantStatus.ts` as the shared source of truth and import them rather than re-implementing pricing, stock, or open/closed logic. All `orders`/`orderEvents` writes go through `lib/orderWrite.ts`.
