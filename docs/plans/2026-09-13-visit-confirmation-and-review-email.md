# Visit Confirmation and Review Email Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Send a rich visit-confirmation email once both the technician and the current schedule are confirmed, then send one optional review request two hours after the customer confirms completion.

**Architecture:** Extend the existing PostgreSQL outbox and Resend worker; do not send from request handlers or create another queue. PostgreSQL derives recipient, eligibility, schedule, address, service and professional data, while TypeScript renders strict versioned templates whose links remain on the configured Lysto origin. Delayed review events use `available_at`; delivery revalidates state and suppresses stale messages.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase PostgreSQL/Auth/RLS, Resend HTTP API, Zod, Vitest, pgTAP, Playwright, GitHub Actions.

---

## Scope and constraints

This work extends roadmap tasks T24 (durable notification delivery) and T36 (external staging acceptance); it does not add new top-level items to the 40-task roadmap.

- Follow `docs/plans/2026-09-13-visit-confirmation-and-review-email-design.md`.
- Do not start Supabase or Docker on the user's machine. Database verification runs in the disposable CI project or against the explicitly identified staging project with the existing rollback guards.
- Create migrations with `pnpm exec supabase migration new <name>`; never invent a timestamp.
- Do not change production, its alias, payment switches, or its Supabase schema while implementing this plan.
- Do not expose a service-role key, address, customer identity, invitation token, provider ID or personal telephone in logs or administrative list responses.
- Email links are authenticated GET destinations. No GET link may confirm a job, create a review, accept a reprogramming or perform any other mutation.
- Preserve the existing outbox lease, fencing, immutable snapshot, idempotency and 23-hour retry behavior.
- Use `America/Argentina/Buenos_Aires` for human-facing schedule text. Persist and compare instants as `timestamptz`.

## Acceptance contract

1. `visit.confirmed` exists only when a job is `confirmed`, a professional is assigned and the current schedule reservation is `confirmed`.
2. Its email contains the service name, local date and time, customer-visible address, professional display name and internal CTAs.
3. The same `(job_id, schedule_version)` produces one email. An approved reprogramming produces one new email for its new version.
4. The old generic customer email for `job.confirmed` does not create a duplicate; in-app notices remain available.
5. `review.requested` is scheduled exactly two hours after the customer's `confirmed` decision.
6. A completed job can have at most one pending/sent review request. A review submitted before dispatch suppresses it.
7. A disputed, cancelled, reopened, inaccessible or identity-mismatched job suppresses the review request.
8. All message HTML has a plain-text equivalent and contains no phone, raw coordinates, query-supplied URLs or mutation links.
9. The implementation remains within Resend Free at the launch budget and exposes alerts before 70 emails/day or 2,400/month.

### Task 1: Lock the template and link contracts with failing tests

**Files:**
- Modify: `tests/unit/notification-delivery-template.vitest.test.ts`
- Modify: `lib/notifications/delivery-template.ts`
- Create: `lib/notifications/email-links.ts`
- Test: `tests/unit/email-links.vitest.test.ts`

**Step 1: Add failing template cases**

Add fixtures for these database-derived contexts:

```ts
const visitContext = {
  eventType: 'visit.confirmed',
  aggregateId: id,
  audience: 'customer',
  scheduleVersion: 3,
  startsAt: '2026-09-18T13:00:00.000Z',
  endsAt: '2026-09-18T15:00:00.000Z',
  timezone: 'America/Argentina/Buenos_Aires',
  serviceName: 'Aire acondicionado',
  professionalName: 'Martín R.',
  addressLabel: 'Av. Siempre Viva 742, Buenos Aires'
} as const

const reviewContext = {
  eventType: 'review.requested',
  aggregateId: id,
  audience: 'customer'
} as const
```

Assert that the visit message:

- has subject `Tu visita con Lysto está confirmada`;
- renders `18 de septiembre`, `10:00` and `12:00` in Buenos Aires;
- includes service, professional and address in HTML and text;
- exposes only URLs under `https://app.lysto.test`;
- contains no `tel:`, coordinates, scripts, event handlers or raw HTML supplied through fields;
- uses `/app/trabajos/<id>` destinations with `#agenda`, `#reprogramacion` and `#contacto` anchors.

Assert that the review message links exactly to `/app/trabajos/<id>/review`, says the review is optional, and does not claim that rating changes payment or completion.

**Step 2: Add failing link-builder tests**

Test an API such as:

```ts
emailJobLinks('https://app.lysto.test', id)
// {
//   detail: 'https://app.lysto.test/app/trabajos/<id>',
//   directions: 'https://app.lysto.test/app/trabajos/<id>#agenda',
//   reschedule: 'https://app.lysto.test/app/trabajos/<id>#reprogramacion',
//   contact: 'https://app.lysto.test/app/trabajos/<id>#contacto',
//   review: 'https://app.lysto.test/app/trabajos/<id>/review'
// }
```

Reject a non-UUID job, credentials, non-root paths, fragments, queries, `javascript:`, and remote HTTP origins. Reuse `notificationOrigin`; do not create a weaker origin parser.

**Step 3: Verify RED**

Run:

```bash
pnpm vitest run tests/unit/notification-delivery-template.vitest.test.ts tests/unit/email-links.vitest.test.ts
```

Expected: FAIL because the new events and `emailJobLinks` do not exist.

**Step 4: Add the minimal typed contract**

Create strict Zod discriminated contexts for `visit.confirmed`, `review.requested`, the existing invitation, and existing simple events. Use `z.string().datetime({ offset: true })`, `z.literal('America/Argentina/Buenos_Aires')`, bounded display strings and positive schedule versions. Continue rejecting unknown keys.

Add `emailJobLinks` and a formatter based on `Intl.DateTimeFormat('es-AR', { timeZone })`. Do not format server-local time or parse a locale-formatted string back into a date.

**Step 5: Render semantic email markup**

Extend `renderOutboxNotification` with:

- a hidden preheader;
- a Lysto header and single-column card using inline styles;
- semantic headings and ordinary `<a>` elements styled as buttons;
- escaped database-derived text;
- a text-only version listing the same facts and links.

Keep `RenderedNotice.version` unchanged only if old snapshots and new contexts can be rendered compatibly. Otherwise introduce `transactional-v2`, accept both versions in the worker snapshot schema, and never rewrite an existing v1 snapshot.

**Step 6: Verify GREEN and commit**

Run the focused tests, then:

```bash
pnpm lint
pnpm typecheck
git add lib/notifications/delivery-template.ts lib/notifications/email-links.ts tests/unit/notification-delivery-template.vitest.test.ts tests/unit/email-links.vitest.test.ts
git commit -m "feat: add visit and review email templates"
```

Expected: focused tests, lint and typecheck pass.

### Task 2: Create the database migration and failing pgTAP specification

**Files:**
- Create through CLI: `supabase/migrations/<generated>_visit_confirmation_and_review_reminders.sql`
- Create: `supabase/tests/database/visit_review_email_notifications.test.sql`
- Modify after generation: `lib/supabase/database.types.ts`

**Step 1: Create the migration file correctly**

Run:

```bash
pnpm exec supabase migration new visit_confirmation_and_review_reminders
```

Expected: one new empty migration with a CLI-generated timestamp.

**Step 2: Write pgTAP cases before SQL implementation**

The database test must create isolated UUID fixtures and verify:

- confirmed job without confirmed schedule creates no visit email;
- confirmed schedule without confirmed job creates no visit email;
- satisfying the second condition creates one `visit.confirmed` email;
- replaying either update leaves the count at one;
- approving a reprogramming with schedule version 2 creates exactly one new confirmation;
- `job.confirmed` still creates its in-app notice but no generic customer email;
- customer confirmation creates `review.requested` with `available_at` between 119 and 121 minutes after the decision timestamp;
- replayed confirmation does not create another review reminder;
- service-role can claim the event only after `available_at`;
- anon/authenticated cannot read or mutate `private.outbox_events` or execute private enqueue helpers.

Rollback all test fixtures. Never truncate shared tables.

**Step 3: Verify RED in disposable CI**

Push the test-only commit or use the repository's isolated CI workflow. Expected: the new pgTAP file fails because the event wiring is absent. Do not start local Supabase.

**Step 4: Implement idempotent enqueue helpers**

The migration should add private functions shaped as follows:

```sql
private.enqueue_visit_confirmation(p_job_id uuid) returns void
private.notify_visit_confirmation_from_job() returns trigger
private.notify_visit_confirmation_from_schedule() returns trigger
private.enqueue_review_request() returns trigger
```

`enqueue_visit_confirmation` must lock/read the job and current confirmed reservation, require `jobs.status='confirmed'`, require an assigned professional, derive the customer profile, and insert one email with a deterministic key equivalent to:

```sql
'visit-confirmed:' || p_job_id::text || ':' || reservation.version::text
```

Use `on conflict(channel, recipient_key, dedupe_key) do nothing`. Call it after a job enters `confirmed` and after a reservation enters `confirmed`. Remove the customer email channel from the old generic `job.confirmed` branch while preserving its in-app channel.

`enqueue_review_request` runs after insertion of `job_customer_decisions`, only for `decision='confirmed'`, and inserts:

```sql
event_type = 'review.requested'
aggregate_type = 'job'
aggregate_id = NEW.job_id
channel = 'email'
available_at = clock_timestamp() + interval '2 hours'
dedupe_key = 'review-requested:' || NEW.job_id::text
```

Resolve the customer profile from the decision's trusted `customer_id`; never accept a recipient parameter from the client.

**Step 5: Harden privileges and convergence**

Use `security definer set search_path=''` only for private trigger functions, fully qualify every object, revoke execution from `public`, `anon`, `authenticated` and `service_role`, and preserve current grants on public worker functions. Make the migration valid both fresh and when upgrading the existing 62-migration schema.

**Step 6: Regenerate types and commit**

After disposable CI or guarded staging applies the migration, regenerate `lib/supabase/database.types.ts` using the repository's established command and verify that only expected schema differences appear.

```bash
git add supabase/migrations supabase/tests/database/visit_review_email_notifications.test.sql lib/supabase/database.types.ts
git commit -m "feat: enqueue visit confirmations and review reminders"
```

### Task 3: Derive delivery context and suppress stale messages

**Files:**
- Modify in the new migration before it is promoted, or create a second CLI-generated migration if Task 2 was already applied anywhere permanent.
- Modify: `supabase/tests/database/visit_review_email_notifications.test.sql`
- Modify: `tests/integration/outbox-worker.test.ts`

**Step 1: Add failing eligibility tests**

For `visit.confirmed`, test `public.resolve_outbox_delivery` returns exactly:

```json
{
  "recipientEmail": "customer@example.test",
  "context": {
    "eventType": "visit.confirmed",
    "aggregateId": "<job>",
    "audience": "customer",
    "scheduleVersion": 1,
    "startsAt": "<ISO instant>",
    "endsAt": "<ISO instant>",
    "timezone": "America/Argentina/Buenos_Aires",
    "serviceName": "<category name>",
    "professionalName": "<first name plus last initial>",
    "addressLabel": "<street number, city>"
  },
  "snapshot": null
}
```

The professional name must not include phone, email, DNI or full private profile data. The address must omit access notes, apartment reference and raw coordinates.

For `review.requested`, require current job status `completed`, a customer decision `confirmed`, ownership match and no row in `reviews`. Assert `22023 recipient_unavailable` after a review, dispute, cancellation, user deletion/ban, email removal or role mismatch.

**Step 2: Implement the resolver branches**

Extend `private.outbox_recipient` to derive every field through joins from the event's aggregate ID. Ignore payload copies for these events. Lock/read the relevant job, reservation, request, category, address, professional/profile and customer/auth identity consistently with the existing resolver.

For a visit event, require the reservation version embedded in the deterministic dedupe key to equal the currently confirmed reservation version. This suppresses an older queued confirmation if a newer reprogramming becomes authoritative before dispatch.

**Step 3: Preserve the final pre-send check**

Do not remove the worker's second `resolve_outbox_delivery` call immediately before Resend. Add an integration case where eligibility changes after snapshot sealing and before `sendEmail`; expected: no provider call and `suppressed` increments.

**Step 4: Run verification and commit**

Run the database suite in disposable CI and:

```bash
pnpm vitest run tests/unit/notification-worker.vitest.test.ts tests/integration/outbox-worker.test.ts
git add supabase/migrations supabase/tests/database/visit_review_email_notifications.test.sql tests/integration/outbox-worker.test.ts
git commit -m "fix: revalidate scheduled email eligibility"
```

Expected: no skipped tests, one provider call for an eligible event, zero for stale events.

### Task 4: Expose authenticated visit actions on the customer job page

**Files:**
- Modify: `app/api/pricing/job/route.ts`
- Modify: `components/pricing/job-quote-panel.tsx`
- Create: `components/customer/job-visit-card.tsx`
- Modify: `app/(customer)/app/trabajos/[id]/page.tsx`
- Test: `tests/unit/customer-job-visit-card.vitest.test.tsx`
- Test: relevant integration access/read-model suite

**Step 1: Write failing component tests**

Cover:

- confirmed reservation renders local date/time, service address and professional public name;
- no phone or email is rendered;
- `#agenda`, `#reprogramacion` and `#contacto` are stable focus targets;
- reprogram action uses the existing `/api/jobs/reschedule` contract;
- contact action opens the existing authenticated support-case path and never a `tel:` or external chat URL;
- non-customer roles do not receive customer contact controls;
- missing/unconfirmed schedule renders a truthful pending state.

**Step 2: Extend the protected read model**

In `app/api/pricing/job/route.ts`, fetch only the active reservation fields, the current customer-visible address fields, category name and public professional display fields. Rely on existing RLS and current job ownership; do not use service role. Parse the response before returning it and keep private responses `no-store`.

Add a `visit` object to `JobData` rather than exposing raw database rows:

```ts
type Visit = {
  scheduleVersion: number
  startsAt: string
  endsAt: string
  timezone: 'America/Argentina/Buenos_Aires'
  addressLabel: string
  professionalName: string
  confirmed: boolean
}
```

**Step 3: Implement the visit card**

Render the card in `JobQuotePanel`. The directions action may create a Google Maps URL only after authenticated data has loaded in the browser; do not place the address in the email URL or server logs. Encode the address with `URLSearchParams` or `encodeURIComponent` and use `rel="noreferrer"` for the external navigation.

Use the existing reschedule endpoint and a real form or link target. If the customer support form cannot open a prefilled job-specific case through its current contract, link to the authenticated job/support screen and label it honestly; do not enable the placeholder chat button.

**Step 4: Verify and commit**

```bash
pnpm vitest run tests/unit/customer-job-visit-card.vitest.test.tsx
pnpm lint
pnpm typecheck
git add app/api/pricing/job/route.ts app/'(customer)'/app/trabajos/'[id]'/page.tsx components/pricing/job-quote-panel.tsx components/customer/job-visit-card.tsx tests/unit/customer-job-visit-card.vitest.test.tsx
git commit -m "feat: add customer visit actions"
```

### Task 5: Verify review timing, uniqueness and customer flow end to end

**Files:**
- Modify: `tests/integration/customer-closeout-review.test.ts` or the existing closeout/review integration file discovered at execution time
- Modify: `tests/e2e/customer-service-flow.spec.ts` or the current canonical customer lifecycle spec
- Modify: `tests/e2e/staging-required-cases.ts` if the mandatory inventory uses an explicit case catalog

**Step 1: Add the integration timeline**

Using real Auth and PostgreSQL fixtures:

1. Complete a job and record customer conformity at `T0`.
2. Assert one `review.requested` event due at `T0 + 2h`.
3. Claim at `T0 + 119m`; expect zero.
4. Claim at `T0 + 121m`; expect one.
5. Submit a review before dispatch in a second case; expect suppression and no provider call.
6. Replay conformity and review commands; expect existing rows and no duplicate event.
7. Confirm another job as disputed; expect no review event.

Use database-controlled timestamps or transaction-safe interval assertions. Do not add a two-hour sleep.

**Step 2: Add browser journeys**

Verify an authenticated customer can:

- open each visit-confirmation CTA and remain on the owned job;
- view the current schedule after reprogramming;
- open the review URL while eligible;
- see `Ya calificaste este servicio` after submitting;
- receive 404/forbidden behavior for another customer's job.

Browser tests must not click an email link that performs a mutation and must not intercept the application's own backend.

**Step 3: Run focused and full checks**

Run focused unit tests locally. Use the disposable CI environment for integration/E2E. Expected: all required browser projects execute with zero skipped cases.

**Step 4: Commit**

```bash
git add tests/integration tests/e2e
git commit -m "test: cover visit and review email journeys"
```

### Task 6: Add volume controls and operating evidence

**Files:**
- Modify: `lib/notifications/operations.ts`
- Modify: `components/admin/connected-notification-deliveries.tsx`
- Modify: `app/api/health/ready/route.ts`
- Modify: `tests/unit/notification-operations.vitest.test.ts`
- Modify: `tests/unit/notification-operations-ui.vitest.test.tsx`
- Modify: `docs/runbooks/notification-delivery.md`

**Step 1: Specify counters without recipient data**

Add aggregate counts for accepted email deliveries in the current UTC day and billing month. Do not return recipient, content, address or provider message ID.

Threshold states:

```ts
daily:  normal < 70, warning >= 70, critical >= 90
monthly: normal < 2400, warning >= 2400, critical >= 2800
```

These thresholds reserve room below Resend Free's 100/day and 3,000/month hard limits.

**Step 2: Surface operational warnings**

Show the counts and warning state in `/admin/notificaciones`. Include them in readiness/alert evaluation without making temporary email-volume pressure mark the whole database dead. The operator action is to pause nonessential review reminders first; visit confirmations and Auth recovery remain priority communications.

**Step 3: Update the runbook**

Document event priority, free-plan thresholds, how to inspect backlog, when to upgrade Resend, and how to suppress stale review reminders without deleting audit history.

**Step 4: Verify and commit**

```bash
pnpm vitest run tests/unit/notification-operations.vitest.test.ts tests/unit/notification-operations-ui.vitest.test.tsx
pnpm lint
pnpm typecheck
git add lib/notifications/operations.ts components/admin/connected-notification-deliveries.tsx app/api/health/ready/route.ts tests/unit/notification-operations.vitest.test.ts tests/unit/notification-operations-ui.vitest.test.tsx docs/runbooks/notification-delivery.md
git commit -m "feat: monitor transactional email allowance"
```

### Task 7: Render and inspect the emails

**Files:**
- Create: `scripts/render-notification-emails.mjs`
- Create: `tests/visual/notification-email-fixtures.ts` if the repository has no equivalent fixture module
- Create generated evidence under ignored `output/email-preview/<timestamp>/`
- Modify: `docs/release/notification-delivery-verification.json`

**Step 1: Create deterministic previews**

Render both HTML and `.txt` outputs from fixed contexts. The script must refuse real email addresses and remote provider calls. Save confirmation and review variants without secrets.

**Step 2: Inspect target widths**

Capture at least 390 px and 720 px widths. Check:

- no horizontal overflow;
- readable hierarchy with images disabled;
- CTA labels remain visible;
- date and address wrap cleanly;
- dark-mode clients retain readable foreground/background contrast;
- plain text lists every fact and destination.

Do not use full-message pixel snapshots as the only test. Keep semantic assertions in Task 1.

**Step 3: Record evidence and commit source only**

Record sanitized paths, dimensions, renderer and manual findings in the verification JSON. Do not commit received messages containing real addresses or identities.

```bash
git add scripts/render-notification-emails.mjs tests/visual docs/release/notification-delivery-verification.json
git commit -m "test: verify transactional email presentation"
```

### Task 8: Run the complete release gates

**Files:**
- Modify only if evidence requires it: `docs/release/notification-delivery-verification.json`
- Modify: `docs/plans/2026-09-10-production-progress.json`
- Modify: `docs/release/production-handover.md`

**Step 1: Run local source checks**

```bash
pnpm test:domain
pnpm test:unit
pnpm test:tooling
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all pass with zero warnings promoted to failures and no skipped mandatory test.

**Step 2: Push and require the disposable CI gate**

Require both Windows domain tests and Ubuntu quality gates to pass. The Ubuntu job must build from a clean checkout, apply every migration fresh, run upgrade compatibility, pgTAP, Auth/payment integration, production build and browser E2E with zero skipped cases.

**Step 3: Audit the diff and worktree**

Confirm:

- no `.env*`, received email, secret, production URL token or synthetic identity is tracked;
- only the CLI-generated migrations were added;
- the unrelated untracked `supabase/tests/fixtures/storage-actors.inc` was not added, modified or deleted;
- production aliases and Supabase production remain untouched.

**Step 4: Commit roadmap evidence**

Update T24/T36 evidence rather than creating tasks 41–48. T24 remains technically implemented; T36 remains externally blocked until sender, scheduler and inbox receipt are proven in staging.

```bash
git add docs/plans/2026-09-10-production-progress.json docs/release/production-handover.md docs/release/notification-delivery-verification.json
git commit -m "docs: record visit and review notification gates"
```

### Task 9: Accept external delivery in staging and prepare production

**Files:**
- Modify: `docs/release/provider-acceptance.md`
- Modify: `docs/release/staging-acceptance.md`
- Modify: `docs/release/notification-delivery-verification.json`
- No secrets in repository files

**Step 1: Configure staging only**

In Vercel Preview/staging, configure the approved `NOTIFICATIONS_EMAIL_FROM`, Resend API key, outbox worker secret and scheduler. Verify the sending domain's SPF, DKIM and DMARC. Keep production email and checkout switches off.

**Step 2: Promote the migration to identified staging**

Use the permanent staging project `obksyzasmfwcbbksesqt`, preflight its project ref and migration history, apply only the new migration set, regenerate/compare types, then run the guarded remote SQL and browser suites. Do not contact or reset production.

**Step 3: Prove real delivery**

With approved synthetic accounts:

- generate one eligible visit confirmation and one delayed review request;
- prove Resend acceptance and receipt in the designated test inbox;
- prove the scheduler drains the queue on consecutive runs;
- prove no duplicate after replay;
- prove a pre-reviewed job is suppressed;
- inspect sanitized Vercel and Resend logs for absence of addresses, auth cookies, tokens and full URLs containing private data;
- remove exact synthetic records and verify zero residual Auth users/profiles.

**Step 4: Measure quota impact**

Record message counts, delivery latency and projected monthly volume. Accept Resend Free only if observed/projected traffic remains below both 70/day and 2,400/month warning thresholds.

**Step 5: Update acceptance records**

Record deployment ID, full commit, migration hash, sender domain status, scheduler evidence, sanitized provider IDs/hashes and approver. Never record API keys or recipient addresses.

**Step 6: Production remains a separate GO/NO-GO**

Only after T37's backup/restore, migration, ownership, Mercado Pago, alerting and approval gates pass may the same release manifest be promoted to production. Enable email independently from checkout, send one authorized canary, verify it, then open normal delivery.

## Final definition of done

- The nine tasks above are implemented and committed in order.
- Fresh and upgrade database paths pass.
- Unit, domain, tooling, integration, build and three browser projects pass with zero mandatory omissions.
- Staging sends and receives both messages through Resend with correct timing and no duplicates.
- Stale review and old schedule events are suppressed.
- Email and UI expose no personal telephone or mutation-bearing GET link.
- Resend Free thresholds and operator response are visible and documented.
- T24/T36 evidence is updated; production remains disabled until the existing GO/NO-GO gates are satisfied.
