# Admin-created Service Requests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Administrators create priced, assigned requests for customers who only confirm terms and pay immediately, with no professional acceptance step.

**Architecture:** Private versioned drafts generate canonical requests, manual quotes, jobs and direct professional assignments atomically. Customer confirmation accepts the frozen quote; existing marketplace checkout continues to derive the authoritative total and split from it. Role-aware RPCs and UI keep internal financial details out of the customer summary.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zod, Supabase/PostgreSQL, Vitest, Playwright.

---

### Task 1: Monetary contract and draft command

- Create `lib/admin/service-request-contract.ts` and `tests/unit/admin-service-request-contract.vitest.test.ts`.
- Test percent and fixed commissions with integer cent rounding, invalid splits, scope validation and stale schedule before implementation. Run `pnpm exec vitest run tests/unit/admin-service-request-contract.vitest.test.ts`, observe failure, implement, rerun.

### Task 2: Controlled persistence and customer acceptance

- Create a migration through the dedicated CLI, private draft table, explicit manual quote origin and financial constraints, private RPCs plus invoker wrappers, role-scoped summaries, and visit/payment guard.
- Add `supabase/tests/database/admin_service_requests.test.sql` with transactional tests for permission denial, version conflicts, hidden drafts, immutable submitted prices and customer acceptance ordering. Verify against the real linked schema without durable test records.
- Create `lib/admin/service-request-service.ts`, admin API and customer confirmation API. Add RPC declarations in `lib/supabase/database.types.ts`.

### Task 3: Administration UI

- Create `components/admin/managed-service-request-form.tsx`, `app/(admin)/admin/solicitudes/nueva/page.tsx`, and links from `app/(admin)/admin/solicitudes/page.tsx` and `app/(admin)/admin/clientes/[id]/page.tsx`.
- Add draft resume list to Solicitudes. Test customer change resets dependent assets, percent/fixed summary, preview, saving and idempotent submit recovery before implementing UI behavior.

### Task 4: Customer confirmation and shared quote display

- Extend `app/api/pricing/job/route.ts`, `components/pricing/job-quote-panel.tsx`, `components/customer/customer-service-detail.tsx`, `components/pricing/quote-breakdown.tsx`, and the quote type with a manual-price marker.
- Add customer confirmation panel with request summary, explicit consent and payment entry. Never enable checkout until the customer confirmation RPC succeeds; existing database payment guards remain authoritative.
- Test immediate customer confirmation without professional acceptance, customer confirmation recovery, no commission display and exact approved total.

### Task 5: Verify and integrate

- Run focused new and existing payment/quote tests, `pnpm typecheck`, targeted ESLint, domain suite and build. Browser-check the form with representative data and mobile width.
- Review code independently using the requesting-code-review skill, address material issues, apply the reviewed migration through the dedicated linked CLI, verify RLS/RPC/constraints, and run security and performance advisors.
- Integrate only feature-owned files into the original workspace, preserving every pre-existing user change. Record actual verification and any deployment limitation.
