# Payment return correction

The first return page required customer session authority before showing a
receipt. Production logs subsequently recorded a 403 on the browser visit,
which the page rendered as a role-specific login prompt. That does not meet
the requested payment → confirmation → home journey.

Provider return URLs now carry a signed capability limited to one checkout's
receipt. It expires seven days after checkout expiry and is domain-separated
from the existing encryption, OAuth and webhook uses of the server key. It
does not sign in, expose customer contact data, authorize another checkout,
create charges, accept work or issue refunds.

The server renders the recorded receipt immediately when available. The client
reads the same restricted receipt and can request canonical provider
reconciliation, subject to same-origin checks and rate limits. URL payment
status and provider IDs are never trusted as proof of approval. Pending states
receive a bounded automatic refresh and a manual retry.

The signed confirmation shows thanks, amount, service/additional, professional
and recorded schedule. Its home action reaches the public home page, so an
unrelated or missing application session cannot turn it into another 404.
The ordinary private account and payment screens retain their existing access
controls. Bare legacy links do not themselves become public receipt authority.

Validation includes forged/expired/cross-checkout tokens, unauthenticated
receipt access with a valid token, rejection without one, canonical payment
state, both provider protocols, and actual production HTTP checks using the
already-approved owner payment. Update only the return destinations of the
two specifically authorized owner payment preferences; preserve their money,
seller, expiry and payment state.
