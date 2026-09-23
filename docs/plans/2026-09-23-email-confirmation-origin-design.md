# Email confirmation origin design

## Problem

The confirmation preview sets `Referrer-Policy: no-referrer`. In a real browser, submitting its same-origin POST form serializes the `Origin` request header as `null`. The confirmation endpoint correctly rejects that value before consuming the one-time token, so customers cannot verify their email.

## Decision

Use `Referrer-Policy: same-origin` for account responses. This retains referrer privacy across origins while allowing same-origin account forms to send the canonical origin required by the CSRF boundary.

Do not accept `Origin: null`, because sandboxed or opaque-origin documents can also produce it. Do not consume confirmation tokens on GET, because mail scanners may follow links automatically.

## Verification

- Unit test the account response header.
- Keep the existing tests that reject missing and cross-origin POST requests.
- Add a browser regression that submits a harmless fake confirmation token and proves the request reaches token validation instead of the origin error.
- Run the focused unit suite, typecheck, and production build before publishing.
