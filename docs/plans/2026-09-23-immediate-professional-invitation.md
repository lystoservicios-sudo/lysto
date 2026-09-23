# Immediate Professional Invitation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make invitation creation attempt delivery immediately and report provider acceptance truthfully.

**Architecture:** Keep the durable outbox and its fenced delivery path. Add a service-role-only RPC to claim one invitation event; invoke the existing worker synchronously for that event after the admin mutation. Preserve retry on failure and refuse creation when email transport is unavailable.

**Tech Stack:** Next.js 15, TypeScript, Vitest, Supabase PostgreSQL, Resend.

---

### Task 1: Targeted claim

**Files:** New `supabase/migrations/*_claim_professional_invitation_outbox.sql`; new database pgTAP test.

1. Write a failing database test showing the RPC claims only the specified `professional.invited` email event and rejects `authenticated`.
2. Run the database test against the existing test environment; confirm the missing RPC is the failure.
3. Generate a migration with `supabase migration new claim_professional_invitation_outbox` and implement a one-row `FOR UPDATE SKIP LOCKED` claim with the same lease and attempt rules as `claim_outbox_events`.
4. Grant execute only to `service_role`; rerun the database tests.

### Task 2: Immediate delivery path

**Files:** `lib/notifications/worker.ts`, `lib/notifications/server.ts`, `lib/professional/onboarding-service.ts`, focused Vitest tests.

1. Add failing tests for exact invitation selection, provider acceptance, unavailable transport, and failure without duplicate creation.
2. Run those tests and confirm expected failures.
3. Extend the worker to accept a targeted invitation ID, reuse the existing snapshot/ACK/FAIL logic, and return exact delivery outcome.
4. Preflight server-only email configuration before the invitation RPC. Dispatch immediately after creation and return `sent` only on provider acceptance.
5. Rerun focused tests.

### Task 3: Honest UI and release verification

**Files:** `components/admin/connected-professional-invitations.tsx`, focused component tests.

1. Add a failing UI test requiring an accepted delivery message only for `sent`, and a clear actionable error otherwise.
2. Implement the status/error UI without exposing the token in list data.
3. Run lint, typecheck, focused tests, then the full relevant suite.
4. Verify production email configuration and database migration before claiming live delivery. Deploy only when both are ready; otherwise report the precise missing external configuration.
