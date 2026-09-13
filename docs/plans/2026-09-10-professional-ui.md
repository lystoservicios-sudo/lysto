# Professional mobile UI implementation plan

**Goal:** Modernize all 13 professional views with the established Lysto identity and a mobile-first field workflow.

**Architecture:** Preserve AppShell, routes and domain services. Reuse PageIntro, CountTabs, StatusPill, buttons, inputs, media uploader and feedback states. Add professional-specific presentation components and scoped CSS; use explicitly labelled session drafts without pretending to perform backend operations.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, Lucide, Vitest, browser QA.

## Approved design

The user approved autonomous implementation of the proposed technician-day direction on 2026-09-10. Light surfaces, Lysto blue, restrained borders, readable type and 48px primary touch controls. Mobile bottom navigation for Inicio, Solicitudes, Trabajos, Agenda and Perfil. Desktop retains the common sidebar. Next-visit card and sequential job progression are the signature, not dashboard ornamentation. Existing admin/customer changes must remain untouched.

## Tasks and verification

1. Write regression tests in `tests/professional-ui.vitest.test.tsx` for all route titles, true detail IDs, professional-only jobs/payments, search, filters, and invalid IDs. Run and record expected failures before implementation.
2. Create `components/pro/pro-model.ts`, `pro-ui.tsx`, and `pro.css`. Centralize demo scope, status grouping, date ordering, safe session drafts, navigation and responsive primitives. Adapt `app/(professional)/pro/layout.tsx` only.
3. Create `pro-lists.tsx`: dashboard, requests, jobs, agenda, payments. Reuse count tabs and empty states. Requests exclude unpaid/unavailable fixtures; personal financial summaries never claim settlement or availability.
4. Create `pro-details.tsx`: request, job and equipment views. Resolve route IDs server-side with notFound. Guided job actions remain explicit simulations; work notes are session drafts, images remain local previews. Unknown or other-professional IDs cannot fall back to the first fixture.
5. Create `pro-account.tsx`: profile, training, support, Mercado Pago and invitation onboarding. Short sections, useful expandable guides, progress and honest disabled integrations. Invitation token is not treated as validated by a cosmetic form. Add loading/error/not-found states.
6. Run focused unit tests, full unit/domain suites, scoped lint and production build. Check all routes at 390px and desktop, plus narrow/landscape widths, keyboard, empty states and draft feedback. Save screenshots and QA report to `output/pro-ui-qa` and `professional-design-qa.md`.

## Constraints

No real assignment, job state, payment, OAuth, notification or document submission is introduced. Session drafts must report persistence failures and reset only their own key. No auth boundary claims: filtering uses the explicit demonstration professional, not a real authenticated principal. No fabricated invitation links. Keep all changes in the user's current workspace, without committing unrelated work.
