# Unified address entry

Keep address selection inside each existing form. Use the same Argentina-only full-address suggestions for customer profile completion, saved addresses, homes, service requests, professional onboarding and the administrator quote calculator. Preserve apartment/floor/access fields and existing stored addresses.

Replace the shared four-field address entry with an adapter over FullAddressCombobox. Preserve canonical structured values, named form inputs and signed proofs. Typing invalidates a previous selection; asynchronous results must not overwrite another record or newer edits. Keep the current service coverage restriction.

Update the remaining legacy address form and administrator calculator. Permit location endpoints for administrators only with the existing operations permission and MFA assurance. Verify submission payloads, invalid-input guards, saved-address edits and stale responses, then run typecheck/lint/build and inspect the same form at mobile width before deploying.
