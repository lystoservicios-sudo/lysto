# Professional invitation uniqueness and cleanup

## Cause and authorized scope

Mario's two directory entries were cancelled invitations, not professional profiles. Both attempts failed during Auth identity creation because their email already belonged to a customer account. The failure happened before email delivery. The old invitation check considered only unexpired active invitations, allowing another cancelled record after each retry. The directory included unbound cancelled invitations as invited people.

The owner explicitly chose to preserve Mario's customer account after being informed of its saved data. Only the two exact cancelled, unconsumed and unprovisioned invitations were removed. Their IDs, states and lack of notification dependencies were checked before deletion, and an audit event was retained for each removal. A recoverable JSON backup is outside the repository under `C:/Users/quime/.codex/backups/lysto/2026-10-25-mario-cancelled-invitations.json`.

Post-cleanup production verification: zero Mario invitations; one customer identity and account retained; 3 addresses, 2 homes, 2 equipment records and 1 equipment image unchanged. Martín's professional profile remains present. The directory query now returns 2 entries.

## Change

Source commit: `218503a`.

Production build completed successfully, including lint/type validation and 115 generated pages. Deployment `dpl_6XDnTfcxiF9wqhdRAA3hEYFw3W4q` was verified as READY for the correct project and full source commit `218503ae692a8ee8e3cb44962a7506fa98e767a3`, then promoted. A fresh lookup confirmed `lystohogar.com` points to that deployment; `/api/health/live` returned `status: live`.

Migration `20261025215555_professional_invitation_email_uniqueness.sql` adds a unique index on normalized invitation email across all statuses and a private trigger that rejects recipients with an existing account before persisting an invitation. Email case and surrounding spaces do not permit duplicates. The index protects concurrent inserts, and changing a recipient is checked too. Normal status changes, binding and resending the same invitation remain supported.

The API and browser request layer distinguish an existing invitation from an existing account. The administrative screen receives actionable Spanish messages instead of a generic stale-data error. Existing active-invitation errors and late Auth collisions are handled as well.

The one-role-per-account model remains unchanged. Preserving Mario's customer account means a new professional account requires a different email. No invitations or other emails were sent during this work.

## Verification

- Reproduced the database defect with an existing account email; the test failed before the migration without retaining any fixture.
- Reproduced six missing error-handling assertions before the application fix.
- 19 tests passed across invitation provisioning, retry UI, registration authentication and private request handling.
- TypeScript, focused ESLint and `git diff --check` passed.
- SQL tests passed in a rolled-back migration dry run and against the applied migration. Coverage includes existing accounts, cancelled invitation duplicates, normalized emails, recipient changes, normal row reuse, a valid unique index, private function permissions and retained RLS.
- Production security/performance advisors reported no error-level findings.
- Migration history was recorded and checked through the linked Management API after the CLI history-repair database connection terminated unexpectedly.

The in-app browser session did not have access to the admin page, and the existing Opera tab could not be acquired. Visual admin verification was therefore unavailable; database behavior and application error handling were verified independently.
