# Four production errors — implementation plan

> Execute sequentially using systematic debugging, test-driven development and verification-before-completion.

**Goal:** Fix the four failures reproduced with the customer, professional and administrator accounts, starting with saved quotes, and verify the deployed result with all three.

**Architecture:** Start from production commit `5d94a2599f3a78355c01e33cf626aa45cf46e546` in an isolated worktree. Preserve accepted money and persisted records; normalize legacy display metadata at read boundaries. Diagnose remaining failures from production logs and scoped database queries before applying minimal fixes.

**Stack:** Next.js 15, React 19, TypeScript, Vitest, PostgreSQL/Supabase, Vercel.

1. Reproduce the legacy quote shape in `tests/unit/quote-breakdown.vitest.test.tsx` and the customer services read model tests. Run them red, normalize missing display fields without recalculating financial values, then run them green.
2. Reproduce the payment runtime role failure (`42501`, `service_requests`) with a read-only database probe. Review the exact query dependencies and ownership boundaries. Implement a durable least-privilege correction with regression verification; verify list, detail and badge queries under the actual runtime role.
3. Reproduce the administrator notification RPC error under an existing authenticated admin context. Correct the specific database/schema failure, adding a focused regression test and migration if needed.
4. Confirm that customer Services and More no longer report partial data after the related quote/payment fixes. Retain real unavailable-state handling.
5. Run relevant unit/integration checks, TypeScript and production build. Review diff, deploy only this isolated source state, check deployment completion and repeat browser checks with saved customer, professional and admin sessions.
6. Record evidence, preserve encrypted sessions and leave the admin dashboard open. No real payments, new requests or job state transitions are part of these checks.

## Execution notes

- Saved quote rendering and customer Services now tolerate missing display metadata while preserving the accepted amounts. Three regressions failed before the change and passed afterward.
- The payment permissions changed externally during this task. Do not duplicate or broaden those grants. The read-only privilege probe passed; the customer payment list, detail and More badge loaded successfully.
- Notification documents now return `providerAccepted: false` for pending deliveries. The read-only SQL regression failed before the migration and passed afterward.
- Restoring the notification screen exposed a related counter bug: SQL excluded deliveries with a null lease. A second migration fixes that predicate; the authenticated administrator screen changed from 0 queued to 25, matching the listed events.
- Both migrations were applied to the linked project and registered in migration history. Existing authorization and function privileges were preserved. Advisors found 71 warnings and no error-level findings; those broader warnings are outside this hotfix.
- Relevant unit/component checks: 119 passing tests across 10 files. TypeScript and changed-file ESLint checks passed.
- The final build, publication and three-role production retest are recorded in `docs/qa/2026-10-20-correcciones-tres-roles.md`.

## Follow-up from the browser retest

- Production accepted quotes also use `{label: string}` address snapshots. Added a failing loader regression, then support for that format without fabricating structured address fields. The regression passed with the complete saved shape.
- A concurrent release replaced the first deployment during the browser retest. Rebased these changes onto the new production commit `c15f95b40be34e79628c1389a1285c02a4f670f9`, preserving the payment-return changes and durable payment read-grant migration.
- Both the local and Vercel builds of the first candidate passed. The combined candidate passed 162 tests in 16 files and its Vercel production build, including lint and TypeScript.
- Final deployment `dpl_GRqo4y3vS5pC5bxHigZmfVKqSGCU` was promoted and verified on `lystohogar.com`. Customer quote, Services, payments, payment record, More and logout passed; professional dashboard/job/payment reads and role boundaries passed; administrator request/job quotes, notifications and dashboard passed.
