import { randomUUID } from 'node:crypto'
import {
  createMercadoPagoSplit,
  MercadoPagoOAuthHttpClient,
  OAuthManager,
  TokenCipher,
  type PaymentWebhookEvent,
  type WebhookSignatureVerificationInput
} from '@waltergaltieri/mercadopago-split'
import { PrismaStorage } from '@waltergaltieri/mercadopago-split/prisma'
import { marketplaceConfig } from './marketplace-config'
import { buildPreferencePayload } from './checkout-contract'
import { applyCanonicalPayment, claimCheckout } from './marketplace-ledger'
import { paymentDatabase, type CheckoutRow } from './marketplace-db'

let storage: PrismaStorage | undefined
export function marketplaceStorage() {
  const databaseUrl = process.env.MERCADOPAGO_DATABASE_URL
  if (!databaseUrl) throw new Error('payments_not_configured')
  return (storage ??= new PrismaStorage({ databaseUrl }))
}
export async function providerJson(
  path: string,
  accessToken: string,
  method = 'GET',
  body?: unknown,
  idempotencyKey?: string
) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('invalid_provider_path')
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'seller_not_linked'
        : 'provider_unavailable'
    )
  const text = await response.text()
  if (text.length > 1_000_000) throw new Error('invalid_provider_response')
  return JSON.parse(text) as Record<string, unknown>
}
export function marketplaceGateway() {
  const config = marketplaceConfig()
  // Each handler gets its own canonical resource map. No data is taken from an
  // unsigned notification body or from another concurrent request's callback.
  const canonical = new Map<string, Record<string, unknown>>()
  const onPayment = async (event: PaymentWebhookEvent) => {
    const payment = canonical.get(event.paymentId)
    if (!payment || !event.externalReference) return
    if (!/^[0-9a-f-]{36}$/i.test(event.externalReference)) return
    await applyCanonicalPayment(event.externalReference, payment, `mp:${event.eventId}`)
  }
  const getPayment = async (id: string, token: string) => {
    const payment = await providerJson(`/v1/payments/${encodeURIComponent(id)}`, token)
    if (String(payment.id) !== id) throw new Error('invalid_provider_response')
    canonical.set(id, payment)
    return payment
  }
  const split = createMercadoPagoSplit({
    ...config,
    storage: marketplaceStorage(),
    oauthHttpClient: marketplaceOAuthHttp(),
    callbacks: {
      onPaymentApproved: onPayment,
      onPaymentPending: onPayment,
      onPaymentInProcess: onPayment,
      onPaymentRejected: onPayment,
      onPaymentCancelled: onPayment,
      onPaymentRefunded: onPayment,
      onPaymentChargedBack: onPayment,
      onPaymentUnknown: onPayment,
      onMerchantOrder: async (event) => {
        const token = await marketplaceOAuth().getValidAccessToken(event.sellerId)
        for (const id of event.paymentIds.slice(0, 50)) {
          const payment = await getPayment(id, token)
          const ref = payment.external_reference
          if (typeof ref === 'string' && /^[0-9a-f-]{36}$/i.test(ref))
            await applyCanonicalPayment(
              ref,
              payment,
              `order:${id}:${String(payment.date_last_updated)}`
            )
        }
      }
    },
    preferenceClientFactory: ({ accessToken }) => ({
      create: async ({ body, requestOptions }) => {
        if (accessToken.startsWith('TEST-') === config.liveMode)
          throw new Error('payment_mode_mismatch')
        const createdAt = new Date(String(body.metadata?.lysto_created_at))
        if (!Number.isFinite(createdAt.getTime())) throw new Error('invalid_checkout_snapshot')
        const payload = buildPreferencePayload(
          { ...body },
          new URL(body.back_urls!.success!).origin,
          createdAt
        )
        return providerJson(
          '/checkout/preferences',
          accessToken,
          'POST',
          payload,
          requestOptions.idempotencyKey
        )
      }
    }),
    webhookResourceClientFactory: ({ accessToken }) => ({
      getPayment: ({ id }) => getPayment(id, accessToken),
      getMerchantOrder: ({ merchantOrderId }) =>
        providerJson(`/merchant_orders/${encodeURIComponent(merchantOrderId)}`, accessToken)
    })
  })
  return split
}
export function marketplaceOAuth() {
  const config = marketplaceConfig()
  return new OAuthManager({
    ...config,
    storage: marketplaceStorage(),
    tokenCipher: new TokenCipher(config.encryptionKey),
    httpClient: marketplaceOAuthHttp()
  })
}
// Keep the upstream bounded OAuth parser, but explicitly request and validate
// the environment before its parser drops live_mode from the token response.
export function marketplaceOAuthHttp() {
  const { liveMode } = marketplaceConfig()
  return new MercadoPagoOAuthHttpClient({
    fetch: async (input, init) => {
      const form = new URLSearchParams(String(init?.body))
      form.set('test_token', String(!liveMode))
      const response = await fetch(input, { ...init, body: form.toString(), cache: 'no-store' })
      if (response.ok) {
        const raw = (await response.clone().json()) as { live_mode?: boolean }
        if (raw.live_mode !== liveMode) throw new Error('payment_mode_mismatch')
      }
      return response
    }
  })
}
export async function createCheckoutPreference(checkout: CheckoutRow) {
  const config = marketplaceConfig()
  const claim = await claimCheckout(checkout.id, config.origin)
  if (!claim.token || !claim.spec) return claim.checkout
  try {
    const account = await marketplaceStorage().getConnectedAccount(checkout.professional_id)
    if (!account?.enabled || account.mercadoPagoUserId !== checkout.seller_account_id)
      throw new Error('checkout_identity_changed')
    const preference = await marketplaceGateway().payments.createPreference(claim.spec)
    const result = await paymentDatabase().query<CheckoutRow>(
      `update public.marketplace_checkouts set preference_id=$3,init_point=$4,sandbox_init_point=$5,
      status=case when status='creating' then 'ready' else status end,lease_until=null,lease_token=null,updated_at=now() where id=$1 and lease_token=$2 returning *`,
      [
        checkout.id,
        claim.token,
        preference.preferenceId,
        preference.initPoint,
        preference.sandboxInitPoint
      ]
    )
    if (!result.rows[0]) throw new Error('checkout_busy')
    return result.rows[0]
  } catch (error) {
    await paymentDatabase().query(
      "update public.marketplace_checkouts set lease_until=null,lease_token=null,last_error='provider_request_failed' where id=$1 and lease_token=$2",
      [checkout.id, claim.token]
    )
    throw error
  }
}
export async function handleMarketplaceWebhook(input: WebhookSignatureVerificationInput) {
  const body = input.body as { type?: string } | undefined
  // The signature does NOT authenticate type/action. A forged mp-connect action
  // must never disable credentials. Account health is checked with the provider.
  if (body?.type === 'mp-connect') return { outcome: 'ignored' }
  return marketplaceGateway().webhooks.handle(input)
}
export async function reconcileCheckout(checkout: CheckoutRow, force = false) {
  const claimed = await paymentDatabase().query(
    "update public.marketplace_checkouts set last_reconciled_at=now() where id=$1 and (last_reconciled_at is null or last_reconciled_at < now()-interval '30 seconds') returning id",
    [checkout.id]
  )
  if (!claimed.rowCount && !force) return
  const token = await marketplaceOAuth().getValidAccessToken(checkout.professional_id)
  const search = await providerJson(
    `/v1/payments/search?external_reference=${encodeURIComponent(checkout.id)}&sort=date_last_updated&criteria=desc&limit=50`,
    token
  )
  if (!Array.isArray(search.results)) throw new Error('invalid_provider_response')
  const paging = search.paging as { total?: number } | undefined
  if (paging?.total && paging.total > 50) {
    await paymentDatabase().query(
      "update public.marketplace_checkouts set status='review',review_reason='too_many_payments' where id=$1",
      [checkout.id]
    )
    throw new Error('checkout_review')
  }
  for (const result of search.results) {
    if (!result || typeof result !== 'object' || !('id' in result)) continue
    const raw = await providerJson(`/v1/payments/${encodeURIComponent(String(result.id))}`, token)
    await applyCanonicalPayment(
      checkout.id,
      raw,
      `reconcile:${String(raw.id)}:${String(raw.date_last_updated)}`
    )
  }
}

/** Close a preference only after a fresh payment search. The returned evidence is
 * persisted by an authenticated finance RPC; this function never changes local state. */
export async function closeCheckoutAtProvider(checkout: CheckoutRow) {
  await reconcileCheckout(checkout, true)
  const observations = await paymentDatabase().query<{
    provider_status: string
    refunded_amount: string
  }>(
    'select provider_status,refunded_amount from public.marketplace_payment_observations where checkout_id=$1',
    [checkout.id]
  )
  if (
    observations.rows.some((row) =>
      ['approved', 'partially_refunded', 'charged_back', 'review'].includes(row.provider_status)
    )
  )
    throw new Error('checkout_review')
  if (
    observations.rows.some(
      (row) =>
        row.provider_status === 'refunded' && Number(row.refunded_amount) < Number(checkout.amount)
    )
  )
    throw new Error('checkout_review')
  if (!checkout.preference_id)
    return { providerPreferenceStatus: 'not_created', verifiedAt: new Date().toISOString() }
  const token = await marketplaceOAuth().getValidAccessToken(checkout.professional_id)
  const path = `/checkout/preferences/${encodeURIComponent(checkout.preference_id)}`
  await providerJson(
    path,
    token,
    'PUT',
    { expires: true, expiration_date_to: new Date(Date.now() - 60_000).toISOString() },
    `close:${checkout.id}`
  )
  const canonical = await providerJson(path, token)
  if (
    String(canonical.id) !== checkout.preference_id ||
    canonical.external_reference !== checkout.id ||
    canonical.expires !== true
  )
    throw new Error('checkout_review')
  const expiration = Date.parse(String(canonical.expiration_date_to ?? ''))
  if (!Number.isFinite(expiration) || expiration > Date.now()) throw new Error('checkout_review')
  return {
    providerPreferenceStatus: 'expired',
    providerPreferenceId: checkout.preference_id,
    providerExpiration: String(canonical.expiration_date_to),
    verifiedAt: new Date().toISOString()
  }
}

export async function renewCheckout(checkout: CheckoutRow) {
  // Renew the SAME provider preference: never issue a second payable link after
  // an ambiguous attempt. Query the canonical payments first, even within 30s.
  await reconcileCheckout(checkout, true)
  const { paymentTransaction } = await import('./marketplace-db')
  const claim = await paymentTransaction(async (db) => {
    const result = await db.query<CheckoutRow>(
      'select * from public.marketplace_checkouts where id=$1 for update',
      [checkout.id]
    )
    const current = result.rows[0]
    if (
      !current?.preference_id ||
      !['ready', 'expired', 'rejected', 'cancelled'].includes(current.status)
    )
      throw new Error('checkout_review')
    if (current.lease_until && current.lease_until.getTime() > Date.now())
      throw new Error('checkout_busy')
    if (current.expires_at.getTime() > Date.now()) return
    const unresolved = await db.query(
      "select 1 from public.marketplace_payment_observations where checkout_id=$1 and provider_status not in ('rejected','cancelled') limit 1",
      [current.id]
    )
    if (unresolved.rowCount) throw new Error('checkout_review')
    const job = await db.query(
      "select 1 from public.jobs where id=$1 and professional_id=$2 and status::text not like 'cancelled%'",
      [current.job_id, current.professional_id]
    )
    if (!job.rowCount) throw new Error('checkout_review')
    const leaseToken = randomUUID(),
      expiresAt = new Date(Date.now() + 30 * 60_000)
    await db.query(
      "update public.marketplace_checkouts set lease_token=$2,lease_until=now()+interval '90 seconds',last_error=null where id=$1",
      [current.id, leaseToken]
    )
    return {
      id: current.id,
      professionalId: current.professional_id,
      sellerId: current.seller_account_id,
      preferenceId: current.preference_id,
      createdAt: current.created_at,
      leaseToken,
      expiresAt
    }
  })
  if (!claim) return
  try {
    const token = await marketplaceOAuth().getValidAccessToken(claim.professionalId)
    const preference = await providerJson(
      `/checkout/preferences/${encodeURIComponent(claim.preferenceId)}`,
      token
    )
    if (
      String(preference.collector_id) !== claim.sellerId ||
      preference.external_reference !== claim.id
    )
      throw new Error('checkout_identity_changed')
    await providerJson(
      `/checkout/preferences/${encodeURIComponent(claim.preferenceId)}`,
      token,
      'PUT',
      {
        expires: true,
        expiration_date_from: claim.createdAt.toISOString(),
        expiration_date_to: claim.expiresAt.toISOString()
      }
    )
    await paymentTransaction(async (db) => {
      const updated = await db.query(
        "update public.marketplace_checkouts set status='ready',expires_at=$3,updated_at=now(),last_error=null,lease_until=null,lease_token=null where id=$1 and lease_token=$2 returning id",
        [claim.id, claim.leaseToken, claim.expiresAt]
      )
      if (!updated.rowCount) throw new Error('checkout_busy')
      await db.query(
        'insert into private.marketplace_applied_events(event_id,checkout_id) values($1,$2) on conflict do nothing',
        [`renew:${claim.id}:${claim.expiresAt.toISOString()}`, claim.id]
      )
    })
  } catch (error) {
    await paymentDatabase().query(
      "update public.marketplace_checkouts set status='review',review_reason='renewal_provider_result_uncertain',last_error='provider_request_failed',lease_until=null,lease_token=null where id=$1 and lease_token=$2",
      [claim.id, claim.leaseToken]
    )
    throw error
  }
}
