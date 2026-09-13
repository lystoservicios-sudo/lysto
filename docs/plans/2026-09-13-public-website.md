# Lysto public website implementation plan

**Goal:** Ship the approved white, blue and pale green public website with Inicio, Solución, Nosotros and Contacto, a real scroll-responsive 3D home, and customer signup, Google OAuth and progressive profile completion.

**Architecture:** Keep the current Next.js application and existing operational screens. Add a scoped marketing system and reusable public layout. Load a native Three.js scene progressively with a raster fallback; use Supabase's current SSR auth and a narrowly scoped database migration for customer provisioning and contact inquiries. Public login is for customers; preserve an unadvertised staff access route for the existing operator/professional flow.

**Tech stack:** Next.js 15, React 19, TypeScript, scoped CSS, Lucide, Three.js, Supabase, Vitest and the in-app browser.

## Approved design

The user selected the first generated direction and explicitly delegated all subsequent decisions. White canvas, cobalt #1554f0, navy text and pale green #ddf5a7. Dominant tactile isometric living room with an air conditioner, sofa, plant, rug and table. Objects respond to scroll; mobile gets its own composition. No more design approval gates.

Conversion sequence: meaningful promise, service selection, simple process, managed-service benefits, coverage and FAQ, closing CTA. Honest copy about the actual initial air-conditioning offer in Buenos Aires; no invented testimonials, performance statistics or commercial guarantees. Main action goes through customer login and resumes service request after account completion.

## Task 1 — Authentication and onboarding (delegated)

- Modify `app/(auth)/login`, `app/(auth)/registro`, `lib/auth`, middleware and the customer access boundary as needed.
- Add OAuth start/callback, email confirmation, password recovery, complete-profile and an internal team login route.
- First add meaningful tests for customer-only access, safe return destinations, incomplete profiles, signup validation and failures. Confirm failure, then implement.
- Persist customer identity and address with least privilege and an idempotent provisioning migration. Google profile data only prefills identity; it never grants roles. Never fabricate auth success.
- Verify unit tests, typecheck and local integration if the existing local Supabase service is available. Document configuration requirements without revealing secrets.

## Task 2 — Public visual system and pages (root)

- Add `components/marketing` styles, navigation, footer, calls to action and accessible interactions.
- Replace home, create `/solucion`, `/nosotros`, `/contacto`; keep existing links useful through redirects or equivalent content.
- Include real contact submission with persisted inquiries and honest failure states. Avoid guessed contact addresses or phone numbers.
- Add keyboard/mobile navigation and contact validation tests before implementing interactive behavior.
- Use scoped styling; preserve the operational UI and all unrelated existing changes.

## Task 3 — Home scene and motion (root)

- Add Three.js as a dynamically imported dependency and create the home from individual real 3D meshes.
- Use an isometric camera, softened geometry, natural lighting, pale green seating, blue rug and white air conditioner.
- Scroll rotates the room slightly and shifts/lifts individual objects; interaction controls highlight installation/repair/maintenance.
- Cap pixel ratio and rendering work, suspend offscreen rendering, clean up resources and honor reduced motion. Load optimized fallback imagery before WebGL.

## Task 4 — Verification and handoff

- Review requirement compliance and then code quality with an independent agent; resolve actionable findings.
- Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`.
- Inspect the actual pages in the in-app browser at phone, tablet and desktop widths. Check navigation, motion, contact form, auth errors, long content and horizontal overflow.
- Leave the finished website open in the app and document any external Google/provider configuration that cannot be verified locally. Do not deploy or send third-party messages implicitly.
