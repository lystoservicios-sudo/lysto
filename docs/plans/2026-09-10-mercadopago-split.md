# Mercado Pago Split Implementation Plan

**Goal:** Integrate the user's Mercado Pago Split package with Lysto quotes, assigned professionals and zero-commission extras.

**Architecture:** Checkout Pro through the package pinned at upstream commit `aeb07a24303edf701004ec1dbb8d4073dc8784af`. Its PostgreSQL adapter owns encrypted OAuth tokens, single-use states and notification deduplication. Lysto adds authenticated Next.js routes and a transaction-backed immutable checkout ledger. Commission is the quote's frozen configured percentage, applied exactly once with cent precision; extras use zero Lysto fee. Mercado Pago processing charges remain separately disclosed.

**Tech stack:** Next.js, Supabase/PostgreSQL, Mercado Pago Split/Prisma adapter, Vitest and pgTAP.

The user authorized full implementation and filling integration gaps. Proceed in this workspace to retain the accepted calculator and ongoing UI changes; do not commit unrelated work or publish/deploy. OAuth grants and production credentials require account owners and are not simulated.

## Tasks

1. Inspect upstream security/adapter/API contracts and official split documentation. Package an exact source revision locally for reproducible installation without private-registry credentials; preserve provenance.
2. Write failing tests for exact split arithmetic, zero-fee extras, authenticated amount sourcing and webhook validation. Implement `lib/payments/marketplace.ts` and configuration boundaries.
3. Create a CLI-named migration: upstream storage tables with browser roles denied; checkout ledger, canonical payment observations and review flags with RLS. Concurrent requests reuse one immutable checkout. Canonical provider observations must match seller, amount, currency, reference and application fee before marking paid. Old observations cannot overwrite newer ones.
4. Implement session-bound OAuth initiation/callback/account status, token renewal via package, and checkout creation only after an approved professional accepts. Webhooks use the package signature verifier and canonical resource fetch, with transactional business deduplication. Add safe server reconciliation and retry handling.
5. Connect professional account UI, customer payment buttons/status, finance configuration and initial/extra breakdowns. Back URLs only display persisted status, never trust query strings as payment approval. Prevent starting visits before verified initial payment.
6. Test signature tampering, concurrent creation, cross-account access, immutable financials, replay/out-of-order callbacks, fee mismatches and zero commission. Run unit/domain, DB, lint, types/build and inspect browser states.
7. Document environment variables, exact callback/webhook URLs, account linking and sandbox-to-live activation. Record limitations and changes relative to upstream; no real charge as part of testing.

## Resultado

Implementación y validación local completadas. Evidencia en `output/payments/verificacion.md`; operación y activación en `docs/mercadopago-split.md`. Las credenciales y consentimientos externos siguen siendo requisitos de activación, sin pagos reales ejecutados durante el desarrollo.
