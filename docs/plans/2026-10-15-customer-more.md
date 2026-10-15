# Customer More Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This session uses subagent-driven-development with independently owned modules and review checkpoints.

**Goal:** Deliver the approved customer Más hub and all account, payments, warranty/support, preferences and security subflows against real persisted application data.

**Architecture:** Reuse the attached `customer-request-checkout` worktree and existing authenticated/RLS boundaries. Preserve Pedir and the frozen Mercado Pago money contract. New account settings/session/privacy RPCs use private implementations, narrow public invoker wrappers and active customer session checks. All UI modules share a small MorePage/MoreSection/MoreLink vocabulary and current Services typography/colors.

**Tech Stack:** Next.js 15 App Router, React 19, CSS modules, lucide-react, Supabase Auth/Postgres/RLS, Zod, Vitest, linked Owner CLI (no Docker/system browser).

## Approved design and scope

- Compact account entry; no greeting or large decorative avatar. `Más` is not just Perfil.
- Payments and support group: pagos/comprobantes, garantías/reclamos, ayuda/mis consultas.
- Configuration group: notificaciones/preferencias, seguridad/cuenta; terms/privacy/logout footer.
- Homes, addresses, equipment and maintenance remain in Hogar; service execution, reviews and reports remain in Servicios. Deep links preserve canonical records.
- White canvas, blue `#075cff`, ink `#0d1830`, secondary `#5d6c84`, separators `#e1e7f0`, ice `#f0f5fd`; compact 18–20px icons, 44px+ targets, 4px spacing scale. Existing font. Border separation, not nested decorative cards. Purposeful 150–200ms motion with system and persisted reduced-motion support.
- Only real supported channels; don't offer fictional WhatsApp/push delivery, wallet, saved-card storage, live chat, guaranteed support SLA, automatic warranty approval or automatic refund.
- Sensitive actions verify own active session/origin and use bounded inputs/rate limits, reauthentication where needed. Never manufacture identities or use user_metadata for authority. Account deletion is an explicit persisted request with operational context, not destructive removal of service/payment records.

## Task 1 — Shared UI and hub (root)

Files: `components/customer/more/more-ui.tsx`, `more.module.css`, `customer-more.tsx`; `app/(customer)/app/mas/page.tsx`; `components/app-shell/client-navigation.ts`; route loading/error states.

1. Write `tests/unit/customer-more.vitest.test.tsx`: six sections, true action counts, no false empty success, footer links/logout; nav selection and focused flow visibility.
2. Run targeted Vitest: confirm meaningful RED.
3. Implement reusable server/client-safe UI exports: `MorePage({title,description,backHref,backLabel,children})`, `MoreSection({title,children})`, `MoreLink({href,title,description,badge,icon})`, `MoreEmpty({title,description})`; modules import CSS directly.
4. Hub reads profile, pending checkout count and cases requiring customer response via canonical services; show partial-read failure explicitly, never fabricate zero counts. Add links and active paths.
5. GREEN and spec/quality review before closing.

## Task 2 — Payments and documents (owned module)

Files: `/app/pagos/**`; `components/customer/more-payments/**`; `lib/customer-more/payments*.ts`; optional own `/api/customer/payments/**`; tests `customer-more-payments*`.

1. TDD ownership/not-found, canonical state mapping, filters, payment detail, receipt and refund detail.
2. List actual customer checkouts/payments with service context and bounded pagination. Detail routes preserve ID and RLS, expose no seller OAuth/private internal metadata. Reuse canonical Mercado Pago handlers/PaymentPanel for actual payment and reconciliation; never calculate a replacement amount, call a provider or issue refunds as part of page reads.
3. Document route displays actual paid transaction metadata and printable/downloadable payment record, clearly not a fiscal invoice. Link actual public service receipt when available, do not synthesize a receipt for a pending payment.
4. Refund detail uses actual request/canonical refund state; route to help when review is needed, never promise automatic approval. No fake movements/hidden owner test widget in the normal customer view.
5. GREEN, self-review and independent reviews. Do not modify core provider ledger or SQL without coordinating root.

## Task 3 — Support and warranties (owned module)

Files: `/app/ayuda/**`, `/app/garantias/**`; `components/customer/more-support/**`; `lib/support/service.ts` if necessary; own support tests. Shared UI is root-owned.

1. TDD authenticated list/detail/new case/reply, ownership, wrong role, attachments, waiting/resolved states, not-found and uncertain network retries.
2. Implement customer FAQ/category/article UI, Mis consultas/open/resolved filters and new case form prefilled from service/payment deep links. Use real existing support RPCs and public event timeline; never expose internalNote/assignment internals to customer HTML/JSON.
3. New case opens via `/api/support/cases`; reply via case PATCH with expectedVersion and correct customer action. Keep idempotency key stable across uncertain creation. Detail must not silently miss cases beyond first100; coordinate narrow read RPC if needed.
4. Warranty list/detail shows real coverage and dates; new recurrence uses `/api/warranty/claim` with owned completed job selection, sameProblem and private evidence uploads; successful creation links same support case, no duplicate case storage. No UUID entry required from customer, no empty quality tab pretending connected data.
5. GREEN and reviews; root coordinates durable SQL migrations and production application.

## Task 4 — Profile, preferences, security/privacy (root + owned backend)

Files: `lib/customer-account/**`, `/api/customer/account/**`, `/api/customer/preferences/**`; `/app/perfil/**`, `/app/preferencias/**`, `/app/seguridad/**`; new migration and rollback SQL; tests `customer-account-*`.

1. RED tests: schema rejects overposting; preferences optimistic versions; own active customer sessions only; private no-store JSON; foreign origin/missing auth; no secrets/internal identifiers in exported payload; password errors; real scoped session revoke; privacy request idempotency and operational safeguards.
2. Generate migration using Owner wrapper `migration new customer_more_account`; persist preferences by customer (email transactional categories, optional marketing, reduceMotion). Tight RLS, immutable owner, bounded tables, private security-definer implementations and public invoker wrappers; self read/write only and audit privacy actions.
3. List real own auth.sessions with sanitized device/activity/current marker via RPC, revoke selected/other sessions with active own identity; never grant clients arbitrary auth schema access. Existing `get_session_context` checks active session. Use official Auth signOut for current logout.
4. Password change uses Auth updateUser with current_password, fresh getUser/role and no password logging. Reuse current policy and recovery flow. Email subpage reuses double-confirmation endpoint. Profile edits reuse versioned asset API with explicit discard/reload.
5. Data export delivers own allowlisted application data only, no tokens/private notes/provider secrets. Deletion request persists in support/account privacy records, shows ongoing work/payment context and resolution tracking. Do not directly delete Auth/customer/payment rows.
6. Preferences hydrate before meaningful client animations and affect CSS/Three animation; honor OS reduce preference regardless of user override. Wire opt-out selections into actual email enqueue/delivery policy, preserving essential security/payment/visit communications; don't display switches with no effect.
7. Apply reviewed exact migration to real linked project, not indiscriminate db push. Rollback-only SQL exercise roles/ownership/versions, followed by fresh state/advisors check. No real customer data rewrites.

## Task 5 — Integration, independent reviews and verification

1. Spec review each module against these tasks, fix all gaps. Then quality/security review of actual diff, not implementer report. Root verifies independent diffs/results.
2. Run targeted integration/UI tests, TypeScript, ESLint, domain/route coverage and Next production build; full unit regression once if proportional, no repeated broad loops.
3. Use Codex IAB only for visual verification if reachable; do not open Opera/Chrome/Edge, bypass a trust rejection or create fake signed sessions. Automated behavioral checks do not masquerade as real visual QA.
4. Verify production migration, RLS/grants and focused persisted operations transactionally. Preserve all existing customer/payment data and prior Pedir activation.
5. Record what was implemented and actual verification, update API inventory and this checklist. No secret files/env duplication, production charges, unrelated changes or surprise Git/main operations.

## Execution status

- [x] Shared UI + hub
- [x] Payments/documents/refunds
- [x] Support/warranties
- [x] Profile/preferences/security/privacy
- [x] Production migration + focused verification
- [x] Independent spec/quality review
- [x] TypeScript/lint/tests/build + truthful handoff (visual limitation recorded below)

## Verified execution evidence

- Reused the attached `customer-request-checkout` worktree; preserved pre-existing Pedir changes. No commit, push, main merge or application deployment performed for Más.
- Account and support migrations first passed rollback-only authorization/state tests against the real linked project. No synthetic Auth rows or case fixtures were committed.
- Applied only `20261015014644_customer_more_account_center` and `20261015014917_customer_support_public_replies` atomically with their exact source recorded in migration history. Fresh independent query confirmed both records, public privacy RLS, forced private reauthentication RLS, authenticated reply execution, anonymous reply denial and service-only email preference gate.
- Post-change security/performance advisors: zero ERRORs; 75 WARNs, the same total as the previous baseline; no findings matching the new account/privacy/reply/delivery objects. This is not a claim that the repository-wide advisory backlog is empty.
- Independent account review accepted explicit isolated password proof and cleanup (not reliance on optional Auth current-password configuration). Independent payments/support review accepted historical-checkout protection, expired-link labels, actor snapshots and durable reply replay.
- Targeted unit regression: 188 checks passed initially; three old boundary assertions referred to replaced component names or mistook a named local filter for global navigation. Updated those approved contracts; the entire 13-check boundary file passed on rerun. All 191 unique checks in the selected 26 files are now green.
- Domain regression: 174/174. API-inventory regression: 1/1. Brief entrance/feedback and reduced-motion style contract: RED observed, then 1/1 GREEN. TypeScript `--noEmit`: exit 0.
- Full ESLint initially found one test variable named `module`; renamed it and focused lint passed. Final full ESLint: exit 0. Full Next production build: exit 0, including compilation, lint/types, all 108 static pages and build traces. This validates the build, not a production UI deployment.
- Visual QA is explicitly not certified: Codex in-app browser rejected its trust bridge. No system browser was opened and no alternate route was used to bypass that rejection. No production charge, provider preference, real password/email change or destructive account deletion was used for testing.

## Publication preparation after explicit user approval

- The user requested main integration and real production publication. The release preserves the previously deployed Pedir prerequisites that had not yet been committed; publishing only the Más paths over the old main would regress the running request/payment contracts.
- Fresh full unit regression covered 201 files and 1,634 checks. Its only failure was a source-contract assertion that did not recognize the new authenticated warranty loader; that assertion was updated, and its complete three-check file passed on a focused rerun. The original full-run report remains unchanged rather than being rewritten as a passing report.
- Fresh domain tests: 174/174; tooling tests: 158/158; full ESLint and TypeScript: exit 0. The previous optimized application build passed; publication performs another hosted build of the committed source.
- The account SQL fixture now has an actual pgTAP plan/final result, with its forty existing authorization/state checks unchanged. A real production rollback-only execution returned `ok 1`, and a fresh query confirmed that all three synthetic Auth identities were absent afterward.
- Public database types were regenerated for the newly migrated schema and normalized to the exact local pg-meta 0.98.0/Prettier 3.5.3 convention. The pre-existing Owner-only test RPC declaration is retained because clean repository migrations create it; no unrelated Owner RPC was recreated in production. The strict CI schema comparator was not weakened.
- Only reviewed application/test/migration/documentation/assets are staged. No environment credentials, local CLI profiles, build outputs or test reports are included. A stale zero-byte worktree index lock was moved to an ignored backup after checking its age and absence of Git processes; code and index contents were not discarded.
- Publication still must be confirmed using the Git main SHA and Vercel Ready/production/domain metadata. Browser-based visual certification remains unavailable because the in-app trust bridge rejects access; this limitation is not bypassed or represented as a successful visual test.
