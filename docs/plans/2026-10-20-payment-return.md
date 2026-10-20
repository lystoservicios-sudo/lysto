# Payment return implementation plan

**Goal:** Give customers a reliable confirmation and service summary after Mercado Pago, including an expired or different-role Lysto session.

**Architecture:** A return page at `/app/pagos/resultado/[checkoutId]` lives outside the customer layout so authentication problems render recovery instead of a 404. Its authenticated API reuses customer payment details with explicit ownership predicates. The client reads the owned checkout, reconciles unsettled payments through the existing canonical provider endpoint, then rereads the ledger. URL status/payment IDs never establish approval.

**Tech stack:** Next.js App Router, React, existing Tailwind components, Supabase session authority, PostgreSQL payment ledger, Vitest.

## Evidence and design

- The authorized ARS 100 service payment was reconciled through the production customer API and its approval was confirmed in the ledger.
- The existing job page returns HTTP 200 and “Presupuesto y adicionales” with the actual customer session. The reported browser session itself could not be inspected. Its exact 404 cause is not proven; the customer layout explicitly returns notFound for other roles.
- Existing return URLs enter that protected layout before reconciliation can run. Middleware will redirect old return URLs to the new recovery-capable page, dropping untrusted provider query fields.
- Approved: thank-you heading, total, service/additional, technician, confirmed schedule or “A coordinar”, payment reference, work and home links. Additional zero-fee copy only when recorded fee is zero.
- Unsettled/error: clearly indicate verification/pending/rejected/refund state, retry status, never initiate a second payment from this page.
- Anonymous/different account: show a customer-login link preserving the checkout path; reveal no payment details.
- Keep navigation explicit so the customer has time to read the confirmation.

## Tasks

1. Add failing return-contract/middleware regressions, ownership tests, and client confirmation/auth/error tests. Run focused Vitest and record expected failures.
2. Add the result read function/API, return page and client component; update provider back URLs and compatibility redirect. Keep existing authorization and reconciliation.
3. Run focused payment, route, middleware, auth, and UI tests; typecheck and lint. Deploy the isolated worktree to the already authorized production project.
4. Verify production legacy redirect, anonymous recovery, owned summary and ledger status using the existing paid checkout. Open the result page for the user.
5. Resume the existing additional-payment journey after the return is fixed: technician proposes ARS 100, customer accepts, user manually confirms payment, then verify recorded Lysto fee zero.
