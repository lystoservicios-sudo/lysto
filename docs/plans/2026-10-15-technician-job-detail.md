# Technician job detail implementation plan

This run executes in the current session with independent ownership and review checkpoints.

**Goal:** Deliver the approved “Expediente compacto” technician job detail and its complete real-service workflow, not a demo.

**Architecture:** Keep the existing authenticated job, diagnosis, extras, closeout, payment and attachment commands. Add a professional-only context read with assignment-scoped access to the contracted equipment/home; render a new professional workspace instead of modifying the customer experience. UI capability checks explain restrictions while the canonical server commands remain authoritative.

**Tech Stack:** Next.js 15 / React 19, TypeScript, scoped CSS, existing Lucide / Three.js room renderer, Supabase SQL functions, Vitest and the Codex in-app browser.

## Delivery record

- Implemented on `codex/technician-job-detail`; both protected technician detail routes use the new workspace. Customer/admin quote panels remain unchanged. Más is a small hub to existing technician functions, not a redesign of those screens.
- Migration `20261015235743` applied and independently checked against the hosted project through the isolated Owner CLI. No customer rows, test services or real payments were created. Existing home RLS/write restrictions remain unchanged.
- Independent spec and quality reviews completed; fixed additional proposals during work, closeout recovery verification, directions, saved-room identity, partial photo retries, revoked-access clearing, terminal-state presentation and report-summary fidelity.
- Verification: 174 domain assertions; 327 related regression tests across 46 files before the last five regressions; model/workspace run 37/37, then workspace 13/13 after the report-summary and cancelled-state refinements. Lint, typecheck and full production build passed. Visual QA and real-component local browser journeys are recorded in root `design-qa.md`.
- The build was isolated on the roomier E: drive. A first environment-only failure proved that the output loaded a second React instance from the original checkout; an isolated runtime parent resolving the worktree's same dependencies fixed the build. No dependency or production configuration change was needed; generated TypeScript includes/references were restored afterwards.
- Production has no assigned real job for a positive technician end-to-end test; database permission/rejection checks were real, while service transitions/uploads were tested with the real components and an isolated local transport. The database fixture suite is ready for CI and was not executed on production. No Docker, personal browser, push to main or deployment was performed.

---

## Approved design and scope

- Selected original: `exec-828c5011-bb3f-4573-89e9-0908d192d405.png` (second displayed proposal).
- Approved refinement: `exec-ef07b4e0-c147-406e-98a1-fd0cdccb0a80.png` (eight related views).
- White canvas, ink `#0d1830`, secondary `#5d6c84`, blue `#075cff`, ice `#f0f5fd`, thin separators, compact persistent job header, 48px controls, 10–16px corners, 150–200ms state transitions with reduced-motion support. No layout movement on focus.
- Screens: summary; assigned equipment/room and technical history; manual travel/arrival/diagnosis progression; diagnosis form; read-only approval wait and requested corrections; optional additional creation/approval/payment; approved work; required closeout; report pending customer conformity; actual related payments and activity.
- App navigation hides during focused forms. The detail uses the approved five destinations; any navigation hub only links existing functions, without redesigning the rest of the professional workspace.
- No invented GPS/OTP, free chat, rescheduling, AR, wallet balance, prices, example records, customer acceptance, certificate or new payment policy.
- Do not change 18/82 base allocation, additional allocation, pricing or payment authorization. Never allow departure without canonical approved initial payment, work without required client acceptance/payment, or technician confirmation on the customer's behalf.
- Existing user edits (`tsconfig.json` line endings in this worktree; unrelated original checkout changes) remain untouched.

## Task 1: Assigned-service read contract

**Files:** Create `lib/professional/job-context.ts`, `lib/professional/job-context-contract.ts`, `app/api/pro/jobs/context/route.ts`, an additive migration in `supabase/migrations/`, `tests/unit/professional-job-context.vitest.test.ts`, and a focused database test under `supabase/tests/` if needed.

1. Write tests for professional-only access, UUID validation, current professional/job ownership, unavailable context failures and strict response projection. Run and observe the expected failure before implementation.
2. Return only the job's issue, reported problem/access notes, linked equipment/history, canonical base/extra payment statuses, and a sanitized home snapshot related to that equipment/address. No other customer's homes or other equipment inventory. Preserve immutable visit-address provenance.
3. Add a private security-definer implementation plus public security-invoker wrapper if owner-only home tables require elevated reads; validate the real authenticated profile, current professional eligibility and assignment. Preserve current financial/admin MFA requirements without adding MFA to ordinary job context. Do not broaden household write policies or provide professional household write access.
4. Create migration through the dedicated Supabase CLI wrapper (never default profile). Query production only through the isolated Owner wrapper or authorized dashboard; use additive SQL, no fixtures or real payment mutations. Prove authorization, apply reviewed migration, run permission-focused read assertions and advisors.
5. Run focused unit/database permission checks and review the response contract with UI owner.

## Task 2: UI capability and navigation model

**Files:** Create `lib/professional/job-workspace-model.ts`, `components/pro/job-workspace.tsx`, `components/pro/job-workspace.module.css`, tests `tests/unit/professional-job-workspace.vitest.test.tsx` and `tests/unit/professional-job-model.vitest.test.ts`.

1. Write red tests for initial-payment waits, manual visit progression, diagnosis submitted/read-only vs changes requested, optional extra approval/payment distinctions, expired/cancelled/read-only states and client conformity. Use live-shaped fixtures only inside tests.
2. Derive the next UI view/action from canonical job, diagnosis, checkout and final-report states. An absent/failed payment lookup never means approved. Do not use optimistic success or a local workflow simulation.
3. Fetch the existing canonical job detail and the new professional context. Scope all async responses and drafts to the requested identity; do not display stale data from another job. Provide loading, retry, 401/403/404/conflict and offline/interrupted-command feedback.
4. Reuse recoverable idempotency keys for real commands. Catch blocked/unavailable session storage; preserve current unsent work and never claim it was saved remotely. Refresh on explicit request, visibility/focus and bounded waits without duplicate writes.
5. Provide summary/equipment/activity tabs, safe map directions from the contracted address, related payments, read-only submitted photos, and return links. No placeholder actions.

## Task 3: Forms and actual evidence

**Files:** New diagnosis/additional controls in `components/pro/job-workspace.tsx` or small colocated modules; modify `components/pro/job-closeout-form.tsx`; add focused unit tests.

1. Write red interaction tests for command payloads, double-submit prevention, upload-before-submit, min/max lengths, diagnosis correction, optional additional creation, read-only approved/submitted data and failed mutation recovery.
2. Use `/api/pricing/job/status` and `/api/jobs/extras` with existing schemas; no business rule fork. Submit only verified attachment UUIDs. Render existing evidence through `/api/uploads/read`, with server-authorized temporary URLs and expiry/error feedback.
3. Restyle the real closeout form to the selected design while preserving required real diagnosis, work, outcome, parts/followup reason, post-work evidence, internal note privacy, maintenance enum and idempotency. Include a return-to-work action without accidentally submitting.
4. Reuse actual `HomeScene` for the authorized household context, with one floor at a time, room/equipment focus and read-only controls. Hide floor controls for a single floor. Provide an honest list/ficha fallback if the customer did not configure a layout or WebGL is unavailable; never invent a saved room.
5. Test request/report photo access and ensure no edit/delete controls appear while awaiting a client decision.

## Task 4: Integrate protected routes and focused shell

**Files:** Modify `app/(professional)/pro/trabajos/[id]/page.tsx`, `app/(professional)/pro/solicitudes/[id]/page.tsx`, professional layout/shell only as needed; a small `app/(professional)/pro/mas/page.tsx` navigation hub if required; navigation tests.

1. Write route/shell red tests. Keep UUID rejection, role/MFA/eligibility guards, customer and admin boundaries and legacy links intact.
2. Mount the new professional workspace only on professional detail routes. Preserve the existing customer `JobQuotePanel` and its behavior.
3. Ensure the approved compact detail header replaces duplicate shell chrome, scoped to detail; show five linked destinations with Trabajos active; hide nav during diagnosis, extras and closeout. Escape/back restores the right prior view and focus.
4. Keep other professional content untouched. Any Más hub is navigation to existing profile, habilitation, security, account, help and guides, not fictitious settings.

## Task 5: Verification and review

1. Run focused tests after each change; then related professional/customer/job/onsite/closeout/payment/attachment regression tests, domain suite, typecheck and lint. Run a production build with sufficient disk space; never start local Docker.
2. Add/adjust browser journeys for the new detail selectors and mandatory waits, without weakening authorization assertions or increasing arbitrary timeouts.
3. Test mobile 390px, narrow 320px and desktop, keyboard focus, reduced motion, refresh, pending/failed payments, submitted/correction states, extra branch, validation and report. Use only the Codex in-app browser. No real charges or customer communications during verification.
4. Compare saved screenshots to the approved reference and record honest visual QA in `design-qa.md` (do not replace unrelated original-workspace QA). Resolve important layout/interaction problems, not unlimited polish loops.
5. Independent spec review followed by code-quality review; fix material findings and rerun relevant checks. Commit only this task's files. Report exact verification and any external blocker; do not claim publication without a deployment. This request authorizes implementation, not an unrelated redesign or an automatic push to main.
