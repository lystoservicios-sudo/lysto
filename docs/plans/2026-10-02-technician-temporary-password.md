# Technician Temporary Password Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Invite HVAC/service technicians with a system-generated seven-digit temporary password and let them resume the existing professional onboarding after each login.

**Architecture:** Keep the existing `professional` role and invitation/application model. Create the Auth identity before sending mail; make the unique invitation token the login destination so the first authenticated session accepts and binds the invitation; thereafter route logins to the saved professional application. Send the credential through the existing Resend provider synchronously but never through the durable outbox snapshot. Restrict password changes until professional setup is complete.

**Tech Stack:** Next.js 15 App Router, Supabase Auth/Postgres RPC and migrations, `@supabase/supabase-js`, Resend transactional email, Vitest/domain test runners.

---

### Task 1: Add focused failing tests for temporary credentials and invite login

**Files:**
- Create or modify tests near `lib/professional/invitation-auth.ts`, `lib/notifications/provider.ts`, and `lib/auth/login.ts` using existing Vitest conventions.

**Step 1:** Add tests for a seven-digit generated credential, delivery content containing login + invite token + credential, and ensuring password content is absent from durable outbox payload/snapshot contracts.

**Step 2:** Add login tests proving a professional invite token is accepted before profile lookup and a later login resumes `/pro/onboarding` without consuming another invite.

**Step 3:** Add authorization tests proving password change is denied before onboarding completion and allowed after the defined completion state.

**Step 4:** Run only the new focused tests and confirm they fail for the intended missing behavior.

### Task 2: Implement invite provisioning and transactional email without storing the password

**Files:**
- `lib/professional/onboarding-service.ts`
- `lib/notifications/server.ts`
- `lib/notifications/delivery-template.ts`
- `lib/notifications/provider.ts`
- `components/admin/connected-professional-invitations.tsx`
- Supabase migration created with `pnpm exec supabase migration new technician_temporary_password`
- `lib/supabase/database.types.ts`

**Step 1:** Add a cryptographic seven-digit generator and server-only Supabase Auth admin client using only `SUPABASE_SERVICE_ROLE_KEY` on the server.

**Step 2:** Extend the invitation RPC lifecycle to create/renew a flow-v2 invitation without a durable credential-bearing email event, safely store only its token hash, update audit/status fields, and support idempotent invite retries.

**Step 3:** Create or reset the invited Auth identity with the temporary password, confirmed email, and trusted `professional` app metadata. Reject unrelated existing identities and compensate/leave a clearly recoverable invitation state on partial failure.

**Step 4:** Render an invitation email that links to `/equipo/login?next=/pro/onboarding/<token>` and contains the email and temporary password. Deliver it synchronously with Resend; do not write its content to the outbox or logs. Persist only provider acceptance/status and show a clear failure if delivery is rejected or uncertain.

**Step 5:** Make resend rotate the invitation token and temporary password, invalidating the old credential; update the admin UI for sent versus failed results.

**Step 6:** Run focused provider/invitation tests and typecheck.

### Task 3: Consume the invite during login and resume professional onboarding

**Files:**
- `app/(auth)/equipo/login/actions.ts`
- `lib/auth/login.ts`
- `app/(professional-onboarding)/pro/onboarding/[token]/page.tsx`
- `components/pro/connected-professional-onboarding.tsx`
- Existing professional invitation API routes under `app/api/professional/onboarding/`

**Step 1:** Parse only the local professional invitation destination from the login request and, after successful sign-in, accept its token through the authenticated RPC before reading profile context; refresh auth claims and preserve current role checks.

**Step 2:** Replace the invite page’s “create a password” UX with clear login instructions/credentials and route to the normal onboarding after invitation acceptance. Subsequent direct `/equipo/login` entries use the existing professional onboarding-status redirect.

**Step 3:** Preserve existing database-backed draft fields and current onboarding step after sign-out, session expiry, or browser close; do not add a second draft store.

**Step 4:** Run focused login/onboarding tests and typecheck.

### Task 4: Gate password changes until technical onboarding is complete

**Files:**
- `app/auth/reset-password/route.ts`
- `app/(auth)/actualizar-contrasena/page.tsx` and a new authenticated password-change action/form as needed
- `lib/professional/onboarding-service.ts` or a focused account lifecycle service
- Supabase migration only if a durable completion marker is required

**Step 1:** Define completion from the existing professional application state and required setup data, including required Mercado Pago connection, without requiring administrative approval to finish account setup.

**Step 2:** Reject authenticated password changes and recovery completions while a professional onboarding is incomplete; keep temporary-password login available so the draft can be resumed.

**Step 3:** Expose a secure change-password flow after setup completion and invalidate/revoke relevant sessions after a successful update according to current session policy.

**Step 4:** Run focused security tests for both the incomplete and completed cases.

### Task 5: Verify integrated behavior and database safety

**Files:** All changed files above.

**Step 1:** Run the full project checks (`pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`) and review failures against baseline.

**Step 2:** Validate the migration’s function grants, RLS boundaries, trusted app metadata handling, invitation lifecycle, and that neither raw credentials nor email snapshots contain the temporary password.

**Step 3:** Confirm the final diff preserves unrelated user changes and report the exact branch/worktree plus any production rollout requirements; do not claim production behavior until deployed and tested there.
