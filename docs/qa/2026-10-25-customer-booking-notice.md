# Customer booking notice — production verification

Date: 2026-10-25 (Argentina).

## Approved policy

New customer requests may select a visit from the third Monday–Friday day after submission. The submission day does not count; national holidays are counted normally. Weekend visits remain selectable after the minimum date, subject to professional availability. Existing requests and committed payment recovery remain valid.

Examples: Sunday 25 October → Wednesday 28 October; Monday 26 October → Thursday 29 October; Friday 30 October → Wednesday 4 November.

## Release

- Implementation: `f8bd22c9728806d03e4b7c3fcb3a81e63d034d52`.
- Supabase project: `dqonlqcurvjnjgsczevu`.
- Applied migration: `20261025195946_customer_booking_notice.sql`; migration history verified.
- Vercel deployment: `dpl_DSDRbRpmyXctuGzdKfEuGidExXBA` (READY), verified against the implementation commit.
- Production domain `lystohogar.com` verified to point to that deployment after promotion.

## Automated checks

Focused Vitest suites passed for the shared date calculation, customer request service, request screens, wizard journey, quote recovery, mocked payment, pricing API, wizard behavior and request access controls. TypeScript, focused ESLint and `git diff --check` passed. The production build completed successfully.

SQL tests passed first inside a rolled-back transaction and again when applying the migration. They cover timezone and year boundaries, holidays counted as weekdays, exact minimum dates, later weekends, attempts to forge or remove the stored minimum, and preservation of existing requests. Installed request/reservation triggers, private function permissions and RLS were verified. Production security/performance advisors reported no error-level findings.

A post-apply query confirmed a minimum date of `2026-10-28`, both enforcement triggers enabled and zero existing requests assigned the new deadline. No historical customer data was rewritten.

## Live browser checks

Verified the customer air-conditioning request flow using the existing `PRUEBA ORS 20-10` fixture on production:

- Step 5 shows the three-business-day policy and explicitly says holidays are not excluded.
- Offered dates begin Wednesday 28 October, followed by Thursday 29, Friday 30 and Saturday 31.
- The custom date field has `min="2026-10-28"`.
- Entering 27 October displays the earliest allowed date and disables review.
- Entering 28 October with a time selected enables review.
- Screenshot saved locally at `output/customer-booking-notice.png` (ignored artifact).

The scoped deployment error-log query returned no entries. This verifies the tested flow and observation window, not the absence of every possible production issue. No request was submitted and no payment was initiated during browser verification.
