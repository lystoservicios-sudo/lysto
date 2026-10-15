# Customer Launch Closeout Implementation Plan

> Execution uses independently owned tasks and independent specification/quality reviews in the current session.

**Goal:** Close customer maintenance and secondary/error screens for the approved launch scope, without adding persisted-draft recovery or rescheduling.

**Architecture:** Reuse the existing authenticated App Shell, More/Services presentation, actual maintenance records and canonical Pedir flow. Maintenance starts no database draft and charges nothing at navigation time; known active services take precedence. Legacy unsubmitted drafts stay preserved but are not advertised as actionable service work. Error boundaries never disclose private resources or assume a lost operation had no effect.

**Tech Stack:** Next.js 15 App Router, React 19, CSS modules, existing Lucide icons, Supabase authenticated reads/RLS, Zod, Vitest and existing CI/browser tests. No Docker or system browser on the user's computer.

## Approved decisions and design

- The user gave implementation/design discretion for maintenance, approved final visual unification including error/404 screens, questioned non-core draft recovery and explicitly deferred rescheduling. Existing local Pedir recovery and uncertain-payment protection remain intact.
- Chosen approach: link maintenance into existing Pedir, retain real recommendation-date changes, and unify secondary pages with the approved presentation. Rejected alternatives: building a second booking flow or persisted-draft recovery now; both expand launch scope. Do not create automatic visits, prices, diagnoses or payments from a recommendation.
- Domain: home, room, air conditioner, preventive care, technical history, visit, service and payment. Users are household clients using a phone to decide their next action. The interface should be calm, direct and grounded in their own equipment.
- Preserve existing white canvas, Lysto blue `#075cff`, ink `#0d1830`, slate `#5d6c84`, ice `#f0f5fd` and separators `#e1e7f0`; inherit the current typeface, 4px spacing system, compact 18–20px icons and at least 44px controls. Use border/tonal separation, not nested decorative cards. Retain brief feedback and OS/account reduced-motion support.
- Signature: actions carry the real equipment/home context into the same service journey. Replace ID-entry forms with owned context, repeated large cards with compact grouped rows and generic dead ends with safe in-app recovery actions.
- No new database schema, production data rewrites, payment settings, prices or split changes are planned. A previously superseded recommendation is identified in the authenticated read projection, not rewritten. Any newly discovered need for durable SQL is reviewed separately before execution.

## Task 1 — Maintenance (independent owner)

**Files:** `components/customer/connected-customer-maintenance.tsx`, `app/(customer)/app/mantenimientos/page.tsx`, `lib/equipment/maintenance-service.ts`, `lib/customer/home-model.ts`; focused maintenance tests and optional new pure maintenance presentation helper.

1. RED: human recommendation/date/status, no UUID/address entry, maintenance link carries owned equipment, navigation creates no request, suppressed/terminal/unverified states cannot create a misleading action, defer sends the real expected version and preserves inputs on failure.
2. Enrich the authenticated read with canonical active job/request context for the same equipment; do not mistake a historical completed source job or old draft for an active service. Use customer-scoped bounded/paginated reads rather than an arbitrary silent limit. Fail closed when current context cannot be verified.
3. Use latest ordered service history to suppress obsolete recommendations superseded by a subsequent report without rewriting stored records. Do not claim that the underlying reminder queue was cancelled.
4. Render `Pedir mantenimiento` into `/app/solicitar/aire-acondicionado?problema=mantenimiento&equipo=<id>` for care that is actually maintenance; pending parts/second visits continue the same real service and do not create a new charged maintenance. No call to legacy `request_service` from this screen.
5. Keep persisted date defer and technical history, loading/empty/error/retry states. `requested` legacy does not imply a booked visit or payment. Propagate optional `activeJobId`, `contextVerified` and `superseded` into Inicio source; root owns Home view-model changes.
6. GREEN and self-review; independent spec review then quality review. Do not modify wizard, tariffs, database schema, shared More styles or root-owned files.

## Task 2 — Secondary visual unification (independent owner)

**Files:** customer `direcciones/page.tsx`, `equipos/page.tsx`, `equipos/[id]/page.tsx`, `equipos/archivo/page.tsx`, `solicitudes/page.tsx`, `presupuestos/page.tsx`; scoped shared secondary presentation wrapper/CSS, corresponding list/form presentation files when necessary and focused tests.

1. RED: same approved page vocabulary/back destinations, no promise to resume old database drafts, real forms and pagination remain functional, unknown/error states are not represented as empty success.
2. Reuse More/Services typography, width, controls, spacing and separators. Keep actual loaders, owner checks, versions, upload handling, read-only archived history and form logic. Scope styles to customer pages, never shared professional/admin components.
3. Addresses/equipment return to Hogar; service/quote/request history returns to Servicios. Retain existing deep links and correct detail selection. General quote list uses the same presentation; do not change shared payment/review business logic.
4. A persisted unsubmitted request without a job must not link to a job-only endpoint or claim resumability; provide honest informational/new-request navigation instead. Preserve historical data.
5. GREEN, self-review and independent spec/quality review. Root owns source filtering and the new Hogar entry shortcuts.

## Task 3 — Error and not-found states (independent owner)

**Files:** new `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, customer `app/not-found.tsx`, `app/[...notFound]/page.tsx`; three existing customer detail `not-found.tsx`, customer `error.tsx` boundaries, shared customer feedback component/CSS and focused tests. Root owns middleware and existing More/payment component copy.

1. RED: safe global/client 404 actions, retry actually invokes reset, no rendering of error messages/stacks/private identifiers, unavailable/foreign IDs have indistinguishable not-found UI, customer unknown route stays in shell, global error includes its own html/body.
2. Use restrained white/blue feedback with clear title/body, safe Inicio/section links and retry where appropriate. No forced redirect from an error and no automatic resubmission of payments/writes. Unknown outcome copy asks to check canonical state before retrying.
3. Cover failures above the customer boundary with root error, and root-layout failures with global error. Preserve Next authentication and 404 status behavior; no permission widening or fake session.
4. Customer catch-all only invokes `notFound()` and reads no data; specific existing routes retain precedence. Keep unrelated professional/admin page design unchanged.
5. GREEN, self-review and independent reviews. Do not modify middleware or shared More states without coordinating root.

## Task 4 — Root integration and launch scope

**Files:** `features/customer/home-view-model.ts`, `features/customer/services-view-model.ts`, relevant authenticated service projection, `components/customer/customer-service-detail.tsx`, Hogar page/entry component, middleware if needed, scoped tests.

1. RED: Inicio `Agregar hogar/equipo` enters the actual Hogar flow, only valid requested modes open, existing pending mutations retain precedence; maintenance already attached to an active service is not a duplicate pending action.
2. Preserve database drafts but exclude them from pending launch actions. Do not build an editor/recovery API. Keep local Pedir persistence and canonical pending-payment recovery unchanged.
3. Hide unfinished client rescheduling entry/hash/form affordances for this release, while preserving backend and other-role capabilities. Add explicit absence tests rather than ignoring old tests.
4. Fix HTML-page infrastructure failure handling so a client page does not receive API JSON; every protected render still verifies authority. Verify approach against Next 15 docs and tests. API failure responses remain unchanged and fail closed.
5. Correct overly conclusive existing error copy about payment/write outcomes.

## Task 5 — Verification and handoff

1. Run focused RED/GREEN tests per owned task, then a consolidated focused regression, TypeScript, ESLint and production build. Inspect independent spec/quality reviews and fix required gaps.
2. Add/extend existing browser tests for unknown customer route, unavailable resource and maintenance-to-Pedir navigation without launching a personal browser or bypassing an in-app trust rejection.
3. Run the full existing CI once on the final candidate, not repeated broad local suites between small changes. If Git/main publication is performed as continuation of the approved customer release, verify remote SHA and platform Ready/domain metadata. Do not claim screenshots/manual visual certification from unit tests.
4. Preserve unrelated original checkout changes, ignored credentials and the existing content-neutral tsconfig normalization. No destructive cleanup, provider charge or real password/email change for testing.

## Execution status

- [x] Maintenance
- [x] Secondary presentation
- [x] Error/404 states
- [x] Launch scope and navigation integration
- [x] Spec and quality review
- [ ] Final candidate CI and publication verification (recorded by the existing release workflow)

Focused regression checks passed, including 64 maintenance/Inicio checks, the full 31-case Hogar recovery suite, 32 owned-detail/page checks, error boundaries, secondary pages and customer quote loading/retry. TypeScript and ESLint passed. One pre-existing Hogar test timed out under simultaneous Windows runners; its complete suite passed unchanged when run alone. The local production compilation was stopped after remaining unfinished; the committed candidate's required CI production build, real isolated database integration and browser checks remain the publication gate.

Reviews corrected active-service deduplication, the Guarantees destination, valid-but-unavailable resource 404s, quote loading/error states and the explicit PostgREST foreign-key relationship. No production schema or data rewrite, payment split/mode change, system browser or local Docker was used.

The first final CI run passed 1,729 unit and 286 integration tests. Its browser journeys all eventually passed but the zero-flaky gate correctly blocked publication: the extra standalone 404 login exceeded the fixture account's real 10-logins/300-second protection, and one existing WebKit administration navigation was not synchronized. The 404 assertions now reuse an already authenticated unavailable-resource journey; the administration test waits for its real link destination before checking content. No rate limit, content assertion, retry allowance or global timeout was relaxed. A clean final CI remains required before publication.
