# Payments (Mollie MVP)

Payment-in only. This covers how a customer pays for an `awaiting_payment`
order and how the order reaches status `new`. Refund **execution**, receipts,
emails and order history are out of scope.

## Flow

1. Checkout places an `awaiting_payment` order (unchanged, Step 6).
2. `/orders/[id]/pay` shows the summary and a single **Pay {total}** button. It
   calls the authenticated action `payments.start`, which:
   - verifies the caller owns the order, it is `awaiting_payment` and not
     expired (typed errors `ORDER_NOT_PAYABLE`, `ORDER_EXPIRED`, `NOT_FOUND`);
   - reuses an existing Mollie payment if it is still `open` (returns its
     checkout URL), otherwise creates a new one. The **amount always comes from
     the order on the server** (öre → `"129.00"` via `toMollieAmount`), currency
     `SEK`, `redirectUrl` → `/orders/[id]/pay/return`, `webhookUrl` →
     `/mollie/webhook`, metadata `{ orderId }`;
   - saves `molliePaymentId` on the order and returns `{ checkoutUrl }`.
3. The browser is sent to Mollie's hosted checkout.
4. Mollie redirects back to `/orders/[id]/pay/return`. **URL parameters are
   never trusted.** The page calls `payments.sync` once, follows
   `payments.getStatus` live, and re-syncs every 5 s for up to 60 s.
   `payments.sync` re-fetches the payment from Mollie and applies the outcome —
   so the page settles even when the webhook is slow (e.g. local dev, where
   Mollie cannot reach `localhost`).
5. In parallel, Mollie POSTs `/mollie/webhook`. The webhook answers `200`
   immediately and schedules an internal action that **re-fetches the payment
   from Mollie** and applies the outcome. The webhook body is never trusted
   beyond the payment id.

> **Local dev:** Mollie refuses a webhook URL it cannot reach, so when
> `CONVEX_SITE_URL` is a loopback address (`127.0.0.1`, `localhost`) the webhook
> URL is **omitted** from the payment. The return page's `payments.sync` settles
> the order instead — so local testing works without a public tunnel. To test
> the webhook itself locally, expose the Convex HTTP origin with a tunnel (e.g.
> ngrok) and set `CONVEX_SITE_URL` to the public URL. In production
> (`https://<deployment>.convex.site`) the webhook is always sent.

Both paths converge on one idempotent internal mutation,
`applyPaymentOutcome`, which:

- resolves the order by `molliePaymentId` (its index) or `metadata.orderId`
  and verifies they agree;
- verifies the Mollie amount + currency equal the order total (`SEK`); on a
  mismatch it records nothing and logs (never applies);
- on `paid`, moves the order to `new` through the shared `applyPayment` helper
  (assigns the daily number, sets `paidAt`) and clears the customer's cart;
- on `failed` / `canceled` / `expired`, records the payment status only and
  leaves the order `awaiting_payment` so the customer can retry;
- on a **late** `paid` for an already cancelled/rejected order, does not reopen
  it: it records the payment and requests a refund (records only — no Mollie
  refund endpoint is ever called), and logs an order event;
- a final `paid` is never overwritten by a later status.

### Known enum limitation

The order `paymentStatus` field is a fixed schema enum
(`pending | paid | failed | expired | refunded`) and the schema is not edited
here. So Mollie's `canceled` is stored as `failed` (identical retry UX) and an
amount `mismatch` cannot be stored — a mismatch is logged and the order is left
untouched (never applied).

## Environment variables

Set on the **Convex** deployment (backend):

| Variable          | Purpose                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `MOLLIE_API_KEY`  | Mollie API key. Read only inside Convex; never logged or returned. A `live_` key is refused unless `MOLLIE_ALLOW_LIVE=true`. |
| `PUBLIC_SITE_URL` | Absolute origin of the customer site, for the Mollie `redirectUrl`.                                                          |
| `CONVEX_SITE_URL` | HTTP-actions origin, for the Mollie `webhookUrl`. Set automatically by Convex.                                               |

Set the key (run in `packages/backend`):

```sh
bunx convex env set MOLLIE_API_KEY <your_test_key>
bunx convex env set PUBLIC_SITE_URL http://localhost:5173   # dev example
```

`CONVEX_SITE_URL` is provided by Convex; set it only if your environment does
not.

## Manual test steps

1. Make sure `MOLLIE_API_KEY` is set on the Convex dev deployment.
2. Sign in as the test customer, add an item, go to checkout, place the order.
3. On the pay page press **Pay**: Mollie's hosted TEST page opens.
4. Choose **Paid**: you return to the site, see "Confirming…", then paid, and
   the order is in status `new`.
5. Repeat and choose **Failed**, **Canceled** and **Expired**: each shows the
   right message and **Try again** works.
6. Open the Convex dashboard logs and confirm the webhook arrived, and check
   that no log line contains the API key.
