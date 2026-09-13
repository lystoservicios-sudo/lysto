# Main and public website production integration

**Goal:** Replace the old public website at https://lystohogar.com with the approved new website, preserve the existing application, consolidate completed work into main, and make main the production source in Vercel.

**Architecture:** Preserve both Git histories and merge the public website/account flows with the production readiness work. Keep production and staging databases separate. Configure the existing Vercel project and domain; apply only reviewed, compatible database changes required by this release.

**Stack:** Next.js, Supabase, GitHub, Vercel, Cloudflare DNS.

## Execution

1. Inventory branches, worktrees, local sources, project settings and environment identities. Exclude secrets, build output and browser artifacts from Git.
2. Save the current source changes in a recoverable commit. Merge production readiness while preserving the new public pages, customer auth and production controls. Independently review semantic conflicts.
3. Run lint, types, domain/unit/tooling tests and production build. Check database migrations against the actual destination history and verify required changes in staging before production.
4. Configure the public origin, database connection and authentication redirects. Keep unavailable payment providers disabled. Verify contact persistence and account boundaries without messaging real customers.
5. Push the consolidated history to main, connect the existing Vercel project to the same GitHub repository, select main for production and deploy the verified commit.
6. Verify deployment identity, domain/TLS and connections. Delete feature branches only after their commits are reachable from main; preserve auxiliary worktree files.

## Acceptance

Deployment adaptation: Vercel's personal-account integration requires the GitHub repository owner, while the user's existing Vercel identity connects another GitHub account. Keep both identities and deploy main through GitHub Actions after CI instead of changing account-wide GitHub authentication. The initial public-site runtime uses APP_ENV=production and PAYMENTS_PROVIDER=disabled with both intake switches explicitly false until the real payment provider is configured. This mode cannot simulate or accept payments.

- The approved new public website is the production deployment for lystohogar.com.
- GitHub main contains both work streams and Vercel builds main.
- No unmerged commits are discarded, no credentials or generated artifacts are committed.
- Existing database records are preserved. Any missing external provider configuration is reported accurately.
- Final branch/deployment IDs and verification results are recorded below.
