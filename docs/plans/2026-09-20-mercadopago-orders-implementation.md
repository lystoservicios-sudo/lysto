# Mercado Pago Checkout Pro vía Orders — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Route new split checkouts through Checkout Pro Orders while preserving legacy Preferences records and leaving live payment activation gated by provider acceptance.

**Architecture:** Keep the existing OAuth, customer authorization, immutable checkout amount and ledger. Add a persisted checkout protocol discriminator and a separate Orders adapter; dispatch create, webhook, reconcile, close, renewal and refund by the stored protocol. Never infer payment success from redirect or unverified webhook content.

**Tech Stack:** Next.js 15, TypeScript, Vitest, PostgreSQL/Supabase migrations and pgTAP, Mercado Pago Orders API.

---

## Task 1 — Schema and protocol dispatch

**Files:** `supabase/migrations/<generated>_marketplace_orders.sql`, `lib/payments/marketplace-db.ts`, `lib/supabase/database.types.ts`, `tests/unit/marketplace-contract.vitest.test.ts`, `supabase/tests/database/*marketplace*.sql`.

1. Add a failing test that a legacy checkout defaults to `preferences`, a new checkout is `orders`, and an order ID cannot coexist with a preference ID. Run `pnpm exec vitest run tests/unit/marketplace-contract.vitest.test.ts` and confirm the expected failure.
2. Discover CLI flags with `pnpm exec supabase migration new --help`, then generate the migration with `pnpm exec supabase migration new marketplace_orders`. Add `checkout_protocol`, `order_id`, `checkout_url`; preserve old columns, grants and RLS. Update the private prepare function so newly created checkouts select Orders and existing checkouts retain Preferences.
3. Update TS row/types and tests. Run the focused test, `pnpm typecheck`, `pnpm exec supabase test db --local` (when local stack is available). Do not push a remote migration.

## Task 2 — Order creation with split and idempotency

**Files:** `lib/payments/orders.ts` (new), `lib/payments/marketplace.ts`, `lib/payments/marketplace-ledger.ts`, `app/api/mercadopago/create-preference/route.ts`, `tests/unit/marketplace-orders.vitest.test.ts` (new), `tests/unit/marketplace-api.vitest.test.ts`.

1. Test the payload before code: `type: online`, `processing_mode: manual`, ARS total string, unchanged checkout UUID `external_reference`, exact `marketplace_fee`, seller OAuth token, stable `X-Idempotency-Key`, and success/pending/failure return URLs. Confirm the test fails because Orders creation does not exist.
2. Implement POST `/v1/orders` for `checkout_protocol=orders`. Validate canonical `id`, `checkout_url`, reference, amount, mode and seller information available in the response; if any required evidence is missing, GET `/v1/orders/{id}`. Persist only validated results. Never retry an uncertain POST under a new idempotency key.
3. Keep the Preferences creation branch exclusively for legacy rows. Return the established route response shape to the frontend, but source its URL from `checkout_url` for Orders. Tests must show test mode never returns a production URL.
4. Run the focused tests and typecheck.

## Task 3 — Signed Orders webhook and canonical ledger

**Files:** `lib/payments/orders.ts`, `lib/payments/marketplace.ts`, `lib/payments/marketplace-ledger.ts`, `app/api/mercadopago/webhook/route.ts`, `tests/unit/marketplace-orders.vitest.test.ts`, `tests/unit/marketplace-ledger.vitest.test.ts`.

1. Add failing tests for signed `type=order` notifications, tampered signatures, mismatched `data.id`, unknown order IDs, repeated events, stale order versions, wrong seller/reference/amount/commission and success/pending/refund states. Preserve existing legacy webhook tests.
2. Verify `x-signature` using the current Mercado Pago signature contract and the server-side webhook secret; use the signed order ID only to fetch `/v1/orders/{id}`. Apply state from the canonical provider response, not webhook body or redirect.
3. Store order observations and project only verified states. A mismatch or undocumented provider shape goes to `review`; never mark a job paid based on a guessed field.
4. Run the focused suite and local ledger integration tests.

## Task 4 — Reconciliation, expiry, close, refunds

**Files:** `lib/payments/marketplace.ts`, `lib/payments/refund-provider.ts`, `lib/payments/financial-operations.ts`, refund worker path identified by `rg executeMercadoPagoRefund`, plus focused unit/integration tests.

1. Add failing tests that Orders reconciliation GETs the stored order ID and Preferences reconciliation retains the old payment search. Duplicate/pending/uncertain outcomes must remain blocked or in review.
2. Dispatch unpaid Orders cancellation via `/v1/orders/{id}/cancel` with a stable idempotency key. Do not create a replacement payable order until canonical cancellation is proven; otherwise mark for review. Keep legacy preference expiry/renewal unchanged.
3. Dispatch Order refunds via `/v1/orders/{id}/refund` with the correct transaction ID for partial refunds; keep legacy `/v1/payments/{id}/refunds` for Preferences. Verify the canonical order after every provider mutation.
4. Run focused tests, then all `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and local DB tests.

## Task 5 — Documentation and provider acceptance gate

**Files:** `docs/mercadopago-split.md`, `docs/release/provider-acceptance.md`, `docs/release/environment-register.md`.

1. Update setup and rollback docs for Checkout Pro Orders, the separate legacy path, and the webhook topic `order`.
2. Document test-account acceptance for OAuth, creation, commission, pending/approved/rejected, duplicate webhooks, cancellation, full/partial refund and reconciliation. Leave every external acceptance row pending until proven with the user's test credentials.
3. Verify repository diff and that production runtime switches remain off; do not deploy, set production secrets or issue real payments in this task.

## External references

- [Orders creation and `marketplace_fee`](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/create-order)
- [Orders notifications](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/notifications)
- [Orders cancellation](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/cancel-order/post)
- [Orders refunds](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/refunds-cancellations)
- [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)
