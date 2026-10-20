# Password recovery with an enrolled authenticator

## Production diagnosis

Supabase Auth recorded `PUT /user` returning HTTP 401 with `insufficient_aal`
on 2026-10-19 at 20:51:28 UTC. The account had a verified TOTP factor. The email
recovery token had already succeeded; updating its password required AAL2.
The application converted this into a generic message asking for another link.
Customer and team login pages use the same Auth identities, so a separate login
URL was not the cause. Password length and reauthentication settings were checked.

## Change

- Check the recovered session's assurance and request its verified authenticator
  before updating the password. Supabase verifies the code; MFA remains enabled.
- Preserve a ten-minute, HMAC-authenticated continuation bound to the recovered
  user and session. The existing server secret `RATE_LIMIT_HASH_KEY` signs a
  purpose-separated payload. Missing secrets fail closed. No password or provider
  token appears in the continuation.
- Retry invalid codes and correctable password errors without reusing the consumed
  email token. JavaScript keeps entered passwords only in the form; the native
  fallback never reflects submitted passwords.
- Validate current Auth identity and signed claims on every continuation. Close
  sessions after success; send professional/admin accounts to `/equipo/login`.
- Keep GET links inert, strict origin validation, private/no-store responses, and
  the professional onboarding gate.

## Verification

Regression tests failed before implementation for missing MFA and incorrect team
redirects. Focused tests cover incorrect codes, session binding, forged/expired
continuations, missing assurance, native password mismatch retries, password
policy retries, and retained browser form fields. Type checking and focused ESLint
passed. The full CI gate additionally runs real Auth/PostgreSQL integration and
browser tests before its production deployment job.

A new disposable integration scenario enrolls TOTP, obtains a recovery link,
submits through the HTTP route, retries an invalid code, changes the password,
then rejects replay with saved recovery cookies and checks the new login.

Production security/performance advisors were run after the authorized manual
password change. They reported warnings about leaked-password protection, an
extension in public, security-definer RPCs, and overlapping permissive policies.
This fix makes no schema, RLS, MFA-factor, or Auth configuration changes.
