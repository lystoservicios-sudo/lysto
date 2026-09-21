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
import { buildPreferencePayload, checkoutProtocol } from './checkout-contract'
import { buildOrderPayload, inspectCanonicalOrder, inspectCreatedOrder, orderIdempotencyKey, verifyOrderWebhookSignature } from './orders'
import { applyCanonicalOrder, applyCanonicalPayment, claimCheckout } from './marketplace-ledger'
import { paymentDatabase, paymentTransaction, type CheckoutRow } from './marketplace-db'

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
  if (checkoutProtocol(checkout) === 'orders' && process.env.MERCADOPAGO_ORDERS_ENABLED !== 'true')
    throw new Error('orders_not_enabled')
  const config = marketplaceConfig()
  const claim = await claimCheckout(checkout.id, config.origin)
  if (!claim.token) return claim.checkout
  try {
    const account = await marketplaceStorage().getConnectedAccount(checkout.professional_id)
    if (!account?.enabled || account.mercadoPagoUserId !== checkout.seller_account_id)
      throw new Error('checkout_identity_changed')
    if (checkoutProtocol(claim.checkout) === 'orders') {
      const accessToken = await marketplaceOAuth().getValidAccessToken(checkout.professional_id)
      if (accessToken.startsWith('TEST-') === config.liveMode) throw new Error('payment_mode_mismatch')
      const payload = buildOrderPayload(claim.checkout, config.origin)
      const raw = await providerJson('/v1/orders', accessToken, 'POST', payload,
        claim.checkout.order_idempotency_key)
      let order: ReturnType<typeof inspectCreatedOrder>
      try {
        order = inspectCreatedOrder(claim.checkout, raw)
      } catch (error) {
        if (typeof raw.id !== 'string' || !/^ORD[A-Z0-9]{5,80}$/.test(raw.id)) throw error
        const canonical = await providerJson(`/v1/orders/${encodeURIComponent(raw.id)}`, accessToken)
        order = inspectCreatedOrder(claim.checkout, canonical)
      }
      return paymentTransaction(async db => {
        const result = await db.query<CheckoutRow>(
          `update public.marketplace_checkouts set order_id=$3,checkout_url=$4,
           status=case when status='creating' then 'ready' else status end,lease_until=null,lease_token=null,updated_at=now()
           where id=$1 and lease_token=$2 and checkout_protocol='orders' returning *`,
          [checkout.id, claim.token, order.id, order.checkoutUrl]
        )
        if (!result.rows[0]) throw new Error('checkout_busy')
        const attempt = await db.query(`insert into private.marketplace_order_attempts(order_id,checkout_id,idempotency_key)
          values($1,$2,$3) on conflict(order_id) do update set order_id=excluded.order_id
          where private.marketplace_order_attempts.checkout_id=excluded.checkout_id
            and private.marketplace_order_attempts.idempotency_key=excluded.idempotency_key
          returning order_id`,
          [order.id,checkout.id,claim.checkout.order_idempotency_key])
        if (!attempt.rowCount) throw new Error('checkout_identity_changed')
        return result.rows[0]
      })
    }
    if (!claim.spec) throw new Error('invalid_checkout_snapshot')
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
  if (body?.type === 'order' || input.query?.type === 'order') {
    const config = marketplaceConfig()
    const orderId = verifyOrderWebhookSignature(input, config.webhookSecret)
    const result = await paymentDatabase().query<CheckoutRow>(
      `select c.* from private.marketplace_order_attempts a
       join public.marketplace_checkouts c on c.id=a.checkout_id
       where a.order_id=$1 and c.checkout_protocol='orders'`, [orderId])
    const checkout = result.rows[0]
    if (!checkout) return { outcome: 'in_progress' }
    if (checkout.live_mode !== config.liveMode) throw new Error('payment_mode_mismatch')
    const token = await marketplaceOAuth().getValidAccessToken(checkout.professional_id)
    const canonical = await providerJson(`/v1/orders/${encodeURIComponent(orderId)}`, token)
    if (checkout.order_id !== orderId) {
      const observed = inspectCanonicalOrder(checkout, canonical)
      if (observed.status !== 'cancelled' || observed.issues.length || observed.orderId !== orderId) {
        await paymentDatabase().query(
          "update public.marketplace_checkouts set status='review',review_reason='historical_order_changed',updated_at=now() where id=$1",
          [checkout.id])
        return { outcome: 'review' }
      }
      return { outcome: 'ignored' }
    }
    return applyCanonicalOrder(checkout.id, canonical,
      `mp-order:${orderId}:${String(canonical.last_updated_date ?? 'unknown')}`)
  }
  return marketplaceGateway().webhooks.handle(input)
}
export async function reconcileCheckout(checkout: CheckoutRow, force = false) {
  const claimed = await paymentDatabase().query(
    "update public.marketplace_checkouts set last_reconciled_at=now() where id=$1 and (last_reconciled_at is null or last_reconciled_at < now()-interval '30 seconds') returning id",
    [checkout.id]
  )
  if (!claimed.rowCount && !force) return
  const token = await marketplaceOAuth().getValidAccessToken(checkout.professional_id)
  if (checkoutProtocol(checkout) === 'orders') {
    if (!checkout.order_id) throw new Error('checkout_review')
    const canonical = await providerJson(`/v1/orders/${encodeURIComponent(checkout.order_id)}`, token)
    await applyCanonicalOrder(checkout.id, canonical,
      `reconcile-order:${checkout.order_id}:${String(canonical.last_updated_date ?? 'unknown')}`)
    return
  }
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
  if (checkoutProtocol(checkout) === 'orders') {
    if (!checkout.order_id) throw new Error('checkout_review')
    const token = await marketplaceOAuth().getValidAccessToken(checkout.professional_id)
    const path = `/v1/orders/${encodeURIComponent(checkout.order_id)}`
    let canonical = await providerJson(path, token)
    let observed = inspectCanonicalOrder(checkout, canonical)
    if (observed.issues.length || observed.orderId !== checkout.order_id ||
        !['ready','cancelled','refunded'].includes(observed.status)) throw new Error('checkout_review')
    if (observed.status === 'ready') {
      await providerJson(`${path}/cancel`, token, 'POST', undefined,
        orderIdempotencyKey(checkout.id, `cancel:${checkout.order_id}`))
      canonical = await providerJson(path, token)
      observed = inspectCanonicalOrder(checkout, canonical)
      if (observed.issues.length || observed.status !== 'cancelled' ||
          observed.orderId !== checkout.order_id) throw new Error('checkout_review')
    }
    await applyCanonicalOrder(checkout.id, canonical,
      `close-order:${checkout.order_id}:${String(canonical.last_updated_date ?? 'unknown')}`)
    return { providerOrderStatus: observed.status, providerOrderId: checkout.order_id,
      verifiedAt: new Date().toISOString() }
  }
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
  if (checkout.closed_for_new_payments_at) throw new Error('checkout_review')
  if (checkoutProtocol(checkout) === 'orders') return renewOrderCheckout(checkout)
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
      current?.closed_for_new_payments_at ||
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

async function renewOrderCheckout(checkout: CheckoutRow) {
  if (process.env.MERCADOPAGO_ORDERS_ENABLED !== 'true') throw new Error('orders_not_enabled')
  if (checkout.closed_for_new_payments_at || checkout.status === 'review') throw new Error('checkout_review')
  await reconcileCheckout(checkout, true)
  const claim = await paymentTransaction(async db => {
    const result = await db.query<CheckoutRow>(
      'select * from public.marketplace_checkouts where id=$1 for update', [checkout.id])
    const current = result.rows[0]
    if (!current || checkoutProtocol(current) !== 'orders' || !current.order_id ||
        current.closed_for_new_payments_at ||
        !['ready','expired','cancelled'].includes(current.status)) throw new Error('checkout_review')
    const activeCase = await db.query(
      "select 1 from private.financial_exception_cases where job_id=$1 and status in ('waiting_reconciliation','ready') limit 1",
      [current.job_id])
    if (activeCase.rowCount) throw new Error('checkout_review')
    if (current.expires_at.getTime() > Date.now()) return null
    if (current.lease_until && current.lease_until.getTime() > Date.now()) throw new Error('checkout_busy')
    const job = await db.query(
      "select 1 from public.jobs where id=$1 and professional_id=$2 and status::text not like 'cancelled%'",
      [current.job_id,current.professional_id])
    if (!job.rowCount) throw new Error('checkout_review')
    const leaseToken = randomUUID()
    await db.query("update public.marketplace_checkouts set lease_token=$2,lease_until=now()+interval '90 seconds' where id=$1",
      [current.id,leaseToken])
    return { current, leaseToken }
  })
  if (!claim) return
  try {
    const token = await marketplaceOAuth().getValidAccessToken(claim.current.professional_id)
    const path = `/v1/orders/${encodeURIComponent(claim.current.order_id!)}`
    let canonical = await providerJson(path, token)
    let observed = inspectCanonicalOrder(claim.current, canonical)
    if (observed.issues.length || observed.orderId !== claim.current.order_id ||
        !['ready','cancelled'].includes(observed.status)) throw new Error('checkout_review')
    if (observed.status === 'ready') {
      await providerJson(`${path}/cancel`, token, 'POST', undefined,
        orderIdempotencyKey(checkout.id, `cancel:${claim.current.order_id}`))
      canonical = await providerJson(path, token)
      observed = inspectCanonicalOrder(claim.current, canonical)
      if (observed.issues.length || observed.orderId !== claim.current.order_id ||
          observed.status !== 'cancelled') throw new Error('checkout_review')
    }
    const renewed = await paymentTransaction(async db => {
      const row = await db.query<CheckoutRow>(
        'select * from public.marketplace_checkouts where id=$1 for update', [checkout.id])
      const current = row.rows[0]
      if (!current || current.lease_token !== claim.leaseToken || current.closed_for_new_payments_at ||
          current.order_id !== claim.current.order_id ||
          ['approved','partially_refunded','refunded','review','pending','in_process'].includes(current.status))
        throw new Error('checkout_review')
      const activeCase = await db.query(
        "select 1 from private.financial_exception_cases where job_id=$1 and status in ('waiting_reconciliation','ready') limit 1",
        [current.job_id])
      if (activeCase.rowCount) throw new Error('checkout_review')
      const attempt = await db.query(
        'update private.marketplace_order_attempts set cancelled_at=now() where order_id=$1 and checkout_id=$2 returning order_id',
        [current.order_id,current.id])
      if (!attempt.rowCount) throw new Error('checkout_review')
      const result = await db.query<CheckoutRow>(`update public.marketplace_checkouts
        set order_id=null,checkout_url=null,order_idempotency_key=$2,status='creating',
          expires_at=now()+interval '30 minutes',last_reconciled_at=null,
          lease_token=null,lease_until=null,last_error=null,updated_at=now()
        where id=$1 returning *`, [current.id,randomUUID()])
      return result.rows[0]
    })
    await createCheckoutPreference(renewed)
  } catch (error) {
    await paymentDatabase().query(
      'update public.marketplace_checkouts set lease_token=null,lease_until=null where id=$1 and lease_token=$2',
      [checkout.id,claim.leaseToken])
    throw error
  }
}
