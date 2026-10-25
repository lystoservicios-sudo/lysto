# Launch security patches implementation plan

**Goal:** Prepare a tested candidate for the 26 October release, fixing the dependency advisories found against the exact production source.

**Architecture:** Keep product behavior and all stored data unchanged. Update Next.js within 15.5, update Zod to its patched v4 release, and adapt only incompatible validation APIs while preserving strict schemas and UUID checks. Keep operational blockers distinct from code verification.

**Base:** `b79eb2b77f746260ae2e764bf9dff099571a6a26`, whose runtime commit `f8bd22c9728806d03e4b7c3fcb3a81e63d034d52` is deployed as `dpl_DSDRbRpmyXctuGzdKfEuGidExXBA`.

1. Preserve the failing production dependency audit as baseline evidence. Upgrade Next and matching ESLint config to 15.5.28, retaining sharp 0.35.5 and the existing PostCSS override.
2. Upgrade Zod and the payment SDK's Zod dependency to 4.6.6. Use compiler errors to locate API incompatibilities. Preserve optional provider metadata, strict object contracts, default values and meaningful errors. Add regression coverage for any behavior changed by the major upgrade before adapting code.
3. Run types, lint, domain tests, unit tests, tooling tests, dependency audit and production build. Review changes independently. Do not replace integration or real payment evidence with unit-test claims.
4. Record production checks and unresolved release blockers: backup/restore, automatic notifications, provider routing coverage and any unavailable authenticated roles. Prepare the candidate before any publication decision.

Official advisories: https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r and https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 . Migration reference: https://zod.dev/v4/changelog . The image RCE advisory already has sharp 0.35.5 mitigation; the Next update also fixes the Server Actions DoS.

**Completion, 25 October:** The candidate passes all 2,271 unit tests across 251 files, 174 domain checks, 160 tooling checks, types, lint, native payment/image checks, production build and a clean production dependency audit. An expired checkout display defect was also reproduced and fixed with regressions. All three authenticated roles were inspected in production. The candidate is not published; notification processing, demonstrated backup/restore and remaining real-flow evidence still block general release. See [the release-readiness report](../qa/2026-10-25-launch-readiness.md).
