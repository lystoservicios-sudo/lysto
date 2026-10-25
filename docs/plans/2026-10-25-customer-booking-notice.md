# Three business days of booking notice

**Goal:** Customers may request service only from the third business day after the day they submit the request, using Argentina's calendar date.

**Architecture:** Share a small date utility between the customer calendar and server preview/prepare paths. Enforce the same rule in PostgreSQL before accepting a new service request, including legacy quote acceptance. Preserve existing reservations and idempotent payment recovery.

**Tech Stack:** TypeScript, React, Next.js, PostgreSQL, Vitest.

## Authorized design and counting assumption

The owner requested three business days instead of next-day booking and explicitly confirmed Monday through Friday without excluding holidays. Do not count the submission day. After the minimum date, weekends remain selectable because the professional may work every day. Existing professional availability still applies.

Examples without holiday exclusions: Sunday 25 October 2026 -> Wednesday 28; Monday 26 -> Thursday 29; Friday 30 -> Wednesday 4 November. Use Argentina's date even while UTC is already on the following day.

Rejected approaches: changing only the date picker would allow old drafts/direct API calls; a 72-hour offset would count weekends. Use the shared business-day calculation plus a database enforcement boundary.

## Implementation and verification

1. Write failing calendar tests for weekends, Argentine midnight, month/year changes and the earliest allowed date. Add server tests for premature preview and an uncommitted preview crossing midnight, preserving committed replay.
2. Add `lib/scheduling/customer-booking-notice.ts`; update `futureVisitDays`, schedule input minimum/error, wizard continuation and review recovery. Show the three-business-day explanation before selection.
3. Validate preview and uncommitted prepare using the server clock, and protect the older customer quote route. Create a CLI-generated migration with the equivalent private date function and checks at request-context and service-request persistence boundaries. Customer rescheduling must not move an existing request before its original submission-day minimum.
4. Verify SQL date cases and transactionally test the enforcement without retaining synthetic requests; retain function ACLs, RLS and existing bookings. Run advisors after applying the migration.
5. Run focused date, request UI/service/payment and pricing tests, TypeScript and ESLint. Stage a production build, verify it, promote it and confirm the live domain's deployment and date-picker minimum.
