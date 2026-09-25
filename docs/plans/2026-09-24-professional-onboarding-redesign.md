# Professional Onboarding Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the administrator-created professional account and resumable onboarding specified by the user.

**Architecture:** Keep invitations as pre-account records and project them alongside accepted professional profiles. Use the existing privileged RPCs and onboarding endpoints, extending their contracts, then present a step-based UI over persisted application data. Keep the review/assignment gate independent of dashboard access.

**Tech Stack:** Next.js 15, React, TypeScript, Vitest, Supabase Postgres/Auth, Resend, Mercado Pago.

---

### Task 1: Minimal invitation and directory

**Files:** `lib/professional/onboarding-service.ts`, `lib/professional/admin-workflow.ts`, `components/admin/connected-professional-invitations.tsx`, `components/admin/connected-professional-directory.tsx`, `app/(admin)/admin/profesionales/invitaciones/page.tsx`, new Supabase migration; tests in `tests/unit/professional-invitation-ui.vitest.test.tsx` and `tests/unit/professional-invitation-link.vitest.test.ts`.

1. Write failing tests for name/surname/email/specialty-only creation, no invitation history, one directory entry per unaccepted invite, and detail navigation.
2. Run targeted Vitest; confirm expected failures.
3. Extend invitation storage/RPC and workflow projection, update UI/API contracts.
4. Run targeted tests and typecheck.

### Task 2: Password-first invitation acceptance

**Files:** `lib/professional/invitation-auth.ts`, `components/pro/invitation-entry.tsx`, invitation API routes, tests in `tests/unit`.

1. Write failing tests for 8–12 character password, direct acceptance, no separate accept button, and existing-account conflict.
2. Implement server-side validation, Auth creation and authenticated RPC acceptance; refresh session and redirect to onboarding.
3. Verify tests and the actual hosted Supabase Auth minimum length. Do not claim production completion while configuration differs.

### Task 3: Persistent onboarding steps

**Files:** `components/pro/connected-professional-onboarding.tsx`, `lib/professional/onboarding-contracts.ts`, relevant Supabase migration, tests in `tests/unit`.

1. Write failing tests for step navigation, per-step save, resume, required documents/avatar, and Mercado Pago last.
2. Implement a stepper backed by existing onboarding/context endpoints; read the saved address through the existing RLS-protected profile column without changing the legacy RPC document.
3. Verify login resume and dashboard redirect after account linking, with review gate intact.

### Task 4: Production verification

1. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
2. Apply migrations against the real Supabase project without Docker, verify RPCs with read-only queries, and check Auth password policy.
3. Deploy to production only after compatible database schema is active, then test invitation delivery and onboarding in the live site.

Deployment note: the redesign migration adds v2 invitation/directory RPCs and leaves legacy strict JSON responses intact, so it can be applied before the new app. It tags new invitations with `flow_version=2`; evidence enforcement and name copying target only that flow. The previous unprocessed invitation-outbox migration must be applied first. Existing invitations that already created an Auth account can still be accepted with their prior password. The current CLI account lacks access to Lysto's Supabase project, so these production steps remain unverified.
