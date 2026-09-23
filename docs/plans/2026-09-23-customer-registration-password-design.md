# Customer registration password design

## Goal

Allow customer accounts to be created with passwords between 6 and 12 characters, and let people reveal or hide either password field while completing the registration form.

## Scope

- Apply the 6–12 character rule to customer registration only.
- Keep login behavior unchanged.
- Keep the password-recovery policy unchanged.
- Lower the Supabase project minimum to 6 so the provider accepts registrations that the application accepts.
- Add reveal controls to both `Contraseña` and `Repetir contraseña` in registration.

## Design

Registration validation will use a dedicated schema instead of sharing the recovery-password schema. The browser constraints, server validation, customer-access validation, visible help text, and Supabase configuration will agree on the same registration limits.

`AuthInput` will gain an opt-in password-visibility mode. When enabled, it will render an accessible button inside a positioned input wrapper, use Lucide's open/closed eye icons, and toggle only that field between `password` and `text`. Existing consumers remain unchanged unless they explicitly enable the control.

## Error handling and accessibility

Invalid registration data continues to return the existing generic registration error, updated to mention 6–12 characters. Reveal buttons use explicit Spanish accessible names, preserve keyboard operation, declare their pressed state, and never submit the form.

## Testing

Unit tests will establish the accepted boundaries (6 and 12), reject 5 and 13, assert the form's native constraints and help text, and verify independent reveal/hide behavior for both password fields. Existing authentication unit tests, type checking, and linting will guard against regressions.
