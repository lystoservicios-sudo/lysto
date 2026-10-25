# Shared address entry across Lysto

The full-address search now appears in the original forms. No route or separate address screen was added.

## Coverage

| Entry point | Implementation |
| --- | --- |
| Customer account completion | CompleteProfileForm keeps the four canonical named form values and signed location proof as hidden fields. |
| Saved addresses reached from account/Hogar | ConnectedCustomerAddresses uses the shared search for create/edit and preserves unchanged locations when editing auxiliary fields. |
| Hogar creation | HomeForm retains apartment, floor, postal code, reference and access fields, including uncertain-save recovery. |
| Service requests | RequestLocationStep uses the same search when adding a home or editing its visit address. Existing-address selection stays available. |
| Professional registration | FullAddressCombobox remains in the original personal-information form; starting another selection invalidates the old proof. |
| Administrator quote calculator | Shared lookup replaces four free-text fields; new quotes require a confirmed selection. Location endpoints retain operations permission, MFA and rate limiting. |
| Legacy CustomerAddressForm | Uses the same shared component and passes the proof to its optional save callback. |

Personal-information-only profile editors and read-only address summaries do not create another address input. Professional profile currently displays its base location; this change does not introduce an unrelated profile editing flow.

## Verification

- New profile-completion and asynchronous auxiliary-field tests failed against the original four-field form before implementation.
- 172 tests passed across 12 suites covering entry points, canonical submissions, invalidation, stale responses, permission/MFA denial, new quote address payloads, saved-address edits, request recovery and atomic home creation/retries.
- Final TypeScript check, focused ESLint and diff whitespace check passed.
- Browser verification used the actual saved-address form and its original page wrapper/styles at a narrow content width, with live GeoRef discovery. Pavón 2012 returned 80 Argentine alternatives including CABA and multiple Buenos Aires localities, with geographic context inside the field's dropdown.
- Screenshot: `output/unified-address-form.png`. This local preview only searches; it does not save addresses or complete accounts.

The national discovery service and existing precise-point/service-coverage checks are preserved. No database migrations, customer data rewrites, invitations, bookings or payments were performed. Existing architecture inventory edits were left untouched.

## Release

Production deployment verification will be recorded after the build and promotion.
