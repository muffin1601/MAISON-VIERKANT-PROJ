# Razorpay Payment Integration

Production-grade online payments for Maison Vierkant. Razorpay is the **primary**
checkout (50% advance); the existing **bank-transfer / proof-upload** flow is kept
as a fallback. No secrets are committed — fill them in `.env`.

## 1. Go live (env)

Set these in `.env` (placeholders already present), then restart the server:

```
PAYMENT_PROVIDER="razorpay"            # flips the gateway from mock → live
RAZORPAY_KEY_ID="rzp_live_xxx"         # or rzp_test_xxx in test mode
RAZORPAY_KEY_SECRET="xxxx"
RAZORPAY_WEBHOOK_SECRET="xxxx"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_xxx"   # MUST equal RAZORPAY_KEY_ID
```

The checkout auto-detects this (`razorpayReady`). Until it's set, checkout
gracefully shows the bank-transfer flow only — nothing breaks.

## 2. Database migration

Additive migration `prisma/migrations/20260622_razorpay_payment_fields` adds
`currency`, `amountRefundedInr`, `webhookVerified`, `paidAt` to `Payment` plus two
indexes. **No existing data is touched.** Apply with:

```
npx prisma migrate deploy
```

## 3. Webhook

In the Razorpay Dashboard → Settings → Webhooks, add:

- URL: `https://<your-domain>/api/payments/webhook`
- Active events: `payment.captured`, `payment.failed`, `refund.created`
- Secret: same value as `RAZORPAY_WEBHOOK_SECRET`

The webhook is the source of truth (resilient to the browser closing) and is
idempotent with the inline `/verify` call.

## 4. Architecture

| Concern | Location |
|---|---|
| Gateway adapter (SDK, HMAC, refund) | `src/services/payment/razorpayService.ts` |
| Order ↔ payment transitions (idempotent) | `src/services/payment/paymentOrders.ts` |
| Enums (no magic strings) | `src/lib/paymentStatus.ts` |
| Create order API | `src/app/api/payments/create-order/route.ts` |
| Verify API (signature) | `src/app/api/payments/verify/route.ts` |
| Webhook API | `src/app/api/payments/webhook/route.ts` |
| Refund API (admin) | `src/app/api/payments/refund/[orderId]/route.ts` |
| Browser SDK loader | `src/hooks/useRazorpay.ts` |
| Client API wrappers | `src/services/payment/paymentClient.ts` |
| Checkout pay panel | `src/features/checkout/RazorpayCheckout.tsx` |
| Admin ledger (filter/search/refund) | `src/features/payments/OnlinePaymentsTable.tsx` |
| Invoice PDF + download | `src/services/orders/InvoicePdf.tsx`, `src/app/api/account/invoice/[orderId]/route.tsx` |

### Order lifecycle
`PENDING_PAYMENT → PAYMENT_PROCESSING → PAYMENT_VERIFIED (paid)`; failure →
`PAYMENT_FAILED` (retryable); refund → `REFUNDED`. Razorpay capture reuses the
existing `PAYMENT_VERIFIED` state so production/dispatch flows are identical for
both payment channels.

### Security
- **Server-authoritative amount** — the advance is recomputed from the stored
  order; the client only sends an `orderId`.
- **Signature verification** (HMAC-SHA256, timing-safe) on every `/verify`.
- **Webhook signature** verified against the raw body; invalid → 400.
- **Idempotency** via unique `gatewayOrderId` / `gatewayPaymentId` + status guards
  → no double captures on double-clicks or webhook+verify races.
- **Refund idempotency** keyed on the Razorpay refund id (admin API + webhook both
  report a refund) — recorded in the audit log so the amount is counted once. A
  partial refund keeps the payment CAPTURED (remaining balance stays refundable);
  only a full refund flips it to REFUNDED. Refund > remaining is rejected.
- **Inventory** is decremented atomically with the capture (same DB transaction)
  for genuinely stocked items; made-to-order items (no/zero on-hand) are skipped so
  they can never oversell or be blocked. Runs once, on first capture only.
- **Webhook events** (signature-verified) are persisted to `AuditLog`
  (`entity = "RazorpayWebhook"`) with ids/amounts/status — no secrets — for replay
  debugging.
- **Cart re-validation** before charge: product exists, active, price unchanged,
  stock (for stocked items).

## 5. Manual QA checklist (test-mode keys)

Use Razorpay test cards (e.g. success `4111 1111 1111 1111`, any future expiry/CVV).

- [ ] Guest checkout → pay advance → order becomes Payment Verified
- [ ] Logged-in customer checkout → order appears in account, invoice downloadable
- [ ] Mobile viewport checkout (Razorpay modal responsive)
- [ ] Desktop checkout
- [ ] Payment success → confirmation email (customer) + new-paid-order email (admin)
- [ ] Payment failure (use a failure test card) → `PAYMENT_FAILED` + inline retry
- [ ] Cancel the Razorpay modal → friendly message, order stays open, retry works
- [ ] Double-click "Pay" → only one gateway order created (idempotent)
- [ ] Webhook recovery: close the tab right after paying → webhook still marks PAID
- [ ] "Pay by bank transfer instead" → bank details + proof upload still work
- [ ] Admin → Payments → Online Payments: filter Paid/Pending/Failed/Refunded,
      search by payment id / order id / name / email
- [ ] Admin refund (full + partial) → status updates, order → REFUNDED on full
- [ ] With keys unset (`PAYMENT_PROVIDER=mock`) checkout falls back to bank transfer

> Note: live charge paths can only be exercised once real test/live keys are in
> `.env`; the build, typecheck, lint and the no-keys fallback path are verified.
