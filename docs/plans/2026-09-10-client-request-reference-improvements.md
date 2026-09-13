# Client request reference improvements

**Goal:** Combine the supplied mobile concepts' clarity with the existing seven-step request flow.

**Architecture:** Preserve pricing, submission, diagnosis rules and shared customer components. Add a focused visual diagnosis component consuming the existing report; improve the wizard's mobile choices, step focus, field labels and a collapsible visit summary. No payment activation, new service slug or backend mutation.

**Tech stack:** Existing Next.js, React, Tailwind, Lucide and Vitest.

## Design decision

User supplied the visual direction and explicitly authorized useful additions. Use selective enhancements, not a pixel clone or a replacement wizard. Keep Lysto blue, existing typography and seven steps. Faults show conditional explanations; installation and maintenance show review scope, never a guaranteed repair. Retiro needs a separate commercial definition and is not silently added as installation.

## Execution

1. Capture and inspect all seven current steps in the local mobile preview, without saving quotes or paying. Record comparison limitations: source images only show client steps 1 and 3; the seventh reference is professional training.
2. Add failing tests in `tests/unit/customer-request-wizard.vitest.test.tsx` for the fault explanations, planned-service scope, focus, neutral initial guidance, accessible equipment selectors, custom-date validation and mobile summary.
3. Add `components/customer/service-diagnosis-step.tsx`, consuming existing diagnosis causes and hints. Use existing icons, short labels, colored icon backgrounds and the technician-confirmation caveat. Leave `preliminary-diagnosis-panel.tsx` unchanged for other consumers.
4. Patch `features/service-request/air-conditioning-wizard.tsx` surgically: compact choices, selection check, focus/scroll on step change, neutral guidance, mobile actions and summary, field names and date validation. Preserve concurrent pricing work.
5. Correct stale introductory copy in the request route so it does not claim that saving a quote sends nothing.
6. Run focused Vitest tests and lint/type checks. Verify fault/planned states in the browser at mobile and desktop widths, including back navigation. Save after screenshots and a concise comparison report.

No commits or deployment are part of this request. Existing unrelated modifications remain untouched.
