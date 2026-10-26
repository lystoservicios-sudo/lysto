# Launch security patches implementation plan

**Goal:** Prepare a tested candidate for the 26 October release, fixing the dependency advisories found against the exact production source.

**Architecture:** Keep product behavior and all stored data unchanged. Update Next.js within 15.5, update Zod to its patched v4 release, and adapt only incompatible validation APIs while preserving strict schemas and UUID checks. Keep operational blockers distinct from code verification.

**Base:** `b79eb2b77f746260ae2e764bf9dff099571a6a26`, whose runtime commit `f8bd22c9728806d03e4b7c3fcb3a81e63d034d52` is deployed as `dpl_DSDRbRpmyXctuGzdKfEuGidExXBA`.

1. Preserve the failing production dependency audit as baseline evidence. Upgrade Next and matching ESLint config to 15.5.28, retaining sharp 0.35.5 and the existing PostCSS override.
2. Upgrade Zod and the payment SDK's Zod dependency to 4.6.6. Use compiler errors to locate API incompatibilities. Preserve optional provider metadata, strict object contracts, default values and meaningful errors. Add regression coverage for any behavior changed by the major upgrade before adapting code.
3. Run types, lint, domain tests, unit tests, tooling tests, dependency audit and production build. Review changes independently. Do not replace integration or real payment evidence with unit-test claims.
4. Record production checks and unresolved release blockers: backup/restore, automatic notifications, provider routing coverage and any unavailable authenticated roles. Prepare the candidate before any publication decision.

Official advisories: https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r and https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 . Migration reference: https://zod.dev/v4/changelog . The image RCE advisory already has sharp 0.35.5 mitigation; the Next update also fixes the Server Actions DoS.

**Completion, 25 October:** The corrections were integrated over the concurrent production source d7ac08d and published as deployment dpl_C9CwFTKtfwuk6QeXuWkvny6o39wW, runtime commit 84749ada84856a1ff18cecc2503f8ffe5473c36b. Final verification passed 2,299 unit tests across 255 files, 174 domain checks, 164 tooling checks, types, lint, the production build and a clean production dependency audit. All three roles were checked again after publication. Internal notifications were recovered to zero pending; the private scheduler completed six consecutive runs. Native encrypted DB/Storage backups were verified on two physical disks and a partial local data restore passed. Automatic email, a fresh real payment/refund, geographic coverage evidence and complete disaster recovery remain explicit limits. See [the release-readiness report](../qa/2026-10-25-launch-readiness.md).
