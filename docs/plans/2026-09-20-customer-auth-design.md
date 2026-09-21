# Customer registration and sign-in design

## Decision

The owner approved completing public customer registration and sign-in through email/password and Google on 2026-09-20. The public routes remain customer-only; professional accounts continue through a verified invitation and a separate onboarding route.

## Current failure

- `/registro` hides both methods when `getRegistrationPolicy()` returns no approved production policy.
- `registerAction` also invokes `requireNewRequests()`, so paused service intake prevents account creation.
- The production Supabase Auth settings report Google disabled. The visible login button returns an unavailable error.

## Chosen approach

Separate account creation from service intake. Retain the existing server-side, versioned legal acceptance and customer-only role assignment. Email registration creates an Auth identity, confirms the email, then bootstraps a customer profile. Google creates/authenticates an identity, then routes a new customer to explicit acceptance and profile completion before allowing access. The customer login route rejects professional/admin roles. Professionals can register only with a valid invitation and gain the professional role only on invitation acceptance.

## Rejected approach

Turning on the existing request/payment switches merely to permit registration would expose unfinished service and payment flows. Replacing Supabase Auth would add risk and is unnecessary.

## Boundaries and verification

Implement and test account-only gating, both authentication methods, redirect and role checks, and clear unavailable-provider feedback. Verify against the remote Supabase project and the deployed web UI without Docker. Production activation requires actual Google OAuth client credentials, Supabase provider and redirect configuration, and a real approved legal policy; no credentials or legal facts are fabricated. Do not claim end-to-end success without completing real email and Google sign-in tests.
