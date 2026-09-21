import { randomUUID } from 'node:crypto'
import type { CreatePreferenceInput } from '@waltergaltieri/mercadopago-split'
import { checkoutAmounts, checkoutProtocol, inspectPayment } from './checkout-contract'
import { paymentDatabase, paymentTransaction, type CheckoutRow } from './marketplace-db'
import { inspectCanonicalOrder } from './orders'

export async function applyCanonicalOrder(checkoutId: string, raw: unknown, eventId: string) {
  return paymentTransaction(async db => {
    const result = await db.query<CheckoutRow>('select * from public.marketplace_checkouts where id=$1 for update', [checkoutId])
    const checkout = result.rows[0]
    if (!checkout || checkoutProtocol(checkout) !== 'orders' || !checkout.order_id) return { ignored: true }
    const order = inspectCanonicalOrder(checkout, raw)
    if (order.orderId !== checkout.order_id) order.issues.push('order_id_mismatch')
    const duplicate = await db.query('insert into private.marketplace_applied_events(event_id,checkout_id) values($1,$2) on conflict do nothing returning event_id', [eventId,checkout.id])
    if (!duplicate.rowCount) return { duplicate: true }
    const existing = await db.query<{ provider_updated_at: Date; provider_status: string }>(
      'select provider_updated_at,provider_status from private.marketplace_order_observations where order_id=$1', [checkout.order_id])
    if (existing.rows[0] && order.updatedAt && new Date(existing.rows[0].provider_updated_at).getTime() >= Date.parse(order.updatedAt))
      return { stale: true }
    if (['approved','partially_refunded','refunded'].includes(existing.rows[0]?.provider_status) &&
        ['ready','pending','rejected','cancelled'].includes(order.status)) order.issues.push('unexpected_status_regression')
    const job = await db.query<{ professional_id: string; status: string; request_id: string }>(
      'select professional_id,status,request_id from public.jobs where id=$1', [checkout.job_id])
    if (job.rows[0]?.professional_id !== checkout.professional_id) order.issues.push('assignment_changed')
    if (String(job.rows[0]?.status).startsWith('cancelled')) order.issues.push('job_cancelled')
    if (checkout.status === 'review' &&
        !(['cancellation_requested','professional_replacement_requested'].includes(checkout.review_reason ?? '') &&
          ['cancelled','refunded'].includes(order.status)))
      order.issues.push('previous_review_requires_operator')
    const protectedReviewReason = checkout.status === 'review' &&
      ['cancellation_requested','professional_replacement_requested'].includes(checkout.review_reason ?? '')
      ? checkout.review_reason : null
    const status = order.issues.length ? 'review' : order.status
    await db.query(`insert into private.marketplace_order_observations
      (order_id,checkout_id,provider_status,provider_updated_at,payment_id,refunded_amount,issues)
      values($1,$2,$3,$4,$5,$6,$7)
      on conflict(order_id) do update set provider_status=excluded.provider_status,
      provider_updated_at=excluded.provider_updated_at,payment_id=excluded.payment_id,
      refunded_amount=excluded.refunded_amount,issues=excluded.issues,observed_at=now()`,
      [checkout.order_id,checkout.id,status,order.updatedAt ?? '1970-01-01T00:00:00Z',order.paymentId,
        order.refundedAmount,JSON.stringify(order.issues)])
    await db.query('update public.marketplace_checkouts set status=$2,review_reason=$3,updated_at=now() where id=$1',
      [checkout.id,protectedReviewReason ? 'review' : status,
        protectedReviewReason ?? (order.issues.length ? [...new Set(order.issues)].join(',') : null)])
    if (!order.issues.length && order.paymentId && order.updatedAt &&
        ['pending','approved','refunded','partially_refunded'].includes(status)) {
      const projection = await db.query<{ id: string }>(`insert into public.payments
        (job_id,request_id,customer_id,professional_id,provider,provider_payment_id,amount,currency,status,payment_type,marketplace_fee,professional_amount,provider_updated_at)
        values($1,$2,$3,$4,'mercadopago',$5,$6,'ARS',$7,$8,$9,$10,$11)
        on conflict(provider,provider_payment_id) where provider_payment_id is not null
        do update set status=excluded.status,provider_updated_at=excluded.provider_updated_at returning id`,
        [checkout.job_id,job.rows[0].request_id,checkout.customer_id,checkout.professional_id,
          order.paymentId,checkout.amount,status,checkout.extra_id ? 'extra_split' : 'service_split',
          checkout.marketplace_fee,checkout.professional_amount,order.updatedAt])
      await db.query(`insert into public.payment_events(payment_id,provider,provider_event_id,event_type,raw_payload)
        values($1,'mercadopago',$2,$3,$4) on conflict(provider,provider_event_id) do nothing`,
        [projection.rows[0].id,eventId,`order.${status}`,JSON.stringify({ checkout_id: checkout.id,
          provider_order_id: checkout.order_id, provider_payment_id: order.paymentId,
          provider_updated_at: order.updatedAt, refunded_amount: order.refundedAmount })])
    }
    return { status }
  })
}

export async function applyCanonicalPayment(checkoutId: string, raw: unknown, eventId: string) {
  return paymentTransaction(async db => {
    const row = await db.query<CheckoutRow>('select * from public.marketplace_checkouts where id=$1 for update', [checkoutId])
    const checkout = row.rows[0]
    if (!checkout) return { ignored: true }
    if (checkoutProtocol(checkout) !== 'preferences') return { ignored: true }
    const payment = inspectPayment(checkout, raw)
    // A payment belonging to another seller/reference cannot poison this job's
    // ledger, even if somebody deliberately reused a visible checkout UUID.
    if (payment.issues.includes('seller_mismatch') || payment.issues.includes('reference_mismatch')) return { ignored:true }
    const duplicate = await db.query('insert into private.marketplace_applied_events(event_id,checkout_id) values($1,$2) on conflict do nothing returning event_id', [eventId,checkout.id])
    if (!duplicate.rowCount) return { duplicate: true }
    const existing = await db.query('select checkout_id,provider_updated_at,provider_status from public.marketplace_payment_observations where provider_payment_id=$1', [payment.paymentId])
    if (existing.rows[0]?.checkout_id && existing.rows[0].checkout_id !== checkout.id) throw new Error('checkout_identity_changed')
    if (existing.rows[0] && new Date(existing.rows[0].provider_updated_at).getTime() >= Date.parse(payment.updatedAt)) return { stale: true }
    if (['approved','partially_refunded','refunded','charged_back'].includes(existing.rows[0]?.provider_status) && ['pending','in_process','rejected','cancelled'].includes(payment.status)) payment.issues.push('unexpected_status_regression')
    const job = await db.query('select professional_id,status,request_id from public.jobs where id=$1', [checkout.job_id])
    if (job.rows[0]?.professional_id !== checkout.professional_id) payment.issues.push('assignment_changed')
    if (String(job.rows[0]?.status).startsWith('cancelled')) payment.issues.push('job_cancelled')
    await db.query(`insert into public.marketplace_payment_observations(provider_payment_id,checkout_id,provider_status,provider_updated_at,refunded_amount,provider_fee,net_received_amount,issues)
      values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(provider_payment_id) do update set provider_status=excluded.provider_status,provider_updated_at=excluded.provider_updated_at,
      refunded_amount=excluded.refunded_amount,provider_fee=excluded.provider_fee,net_received_amount=excluded.net_received_amount,issues=excluded.issues,observed_at=now()`,
    [payment.paymentId,checkout.id,payment.status,payment.updatedAt,payment.refundedAmount,payment.providerFee,payment.netReceived,JSON.stringify(payment.issues)])
    const observations = await db.query<{ provider_status:string; issues:string[] }>('select provider_status,issues from public.marketplace_payment_observations where checkout_id=$1', [checkout.id])
    const paid = observations.rows.filter(p => ['approved','partially_refunded','charged_back'].includes(p.provider_status))
    const issues = [...new Set(observations.rows.flatMap(p => p.issues))]
    if (paid.length > 1) issues.push('multiple_payments')
    const status = issues.length ? 'review' : paid.length ? paid[0].provider_status : observations.rows.some(p => p.provider_status === 'refunded') ? 'refunded' : ['pending','in_process'].includes(payment.status) ? payment.status : ['rejected','cancelled'].includes(payment.status) ? payment.status : 'review'
    await db.query('update public.marketplace_checkouts set status=$2,review_reason=$3,updated_at=now() where id=$1', [checkout.id,status,issues.length ? issues.join(',') : status === 'review' ? 'unknown_provider_status' : null])
    if (!payment.issues.length) {
      const mappedStatus = payment.status === 'charged_back' ? 'failed' : payment.status === 'in_process' || payment.status === 'unknown' ? 'pending' : payment.status
      if (['pending','approved','rejected','cancelled','refunded','partially_refunded','failed'].includes(mappedStatus)) {
        const projection = await db.query(`insert into public.payments(job_id,request_id,customer_id,professional_id,provider,provider_payment_id,amount,currency,status,payment_type,marketplace_fee,professional_amount,provider_updated_at)
          values($1,$2,$3,$4,'mercadopago',$5,$6,'ARS',$7,$8,$9,$10,$11)
          on conflict(provider,provider_payment_id) where provider_payment_id is not null do update set status=excluded.status,provider_updated_at=excluded.provider_updated_at returning id`,
        [checkout.job_id,job.rows[0].request_id,checkout.customer_id,checkout.professional_id,payment.paymentId,checkout.amount,mappedStatus,checkout.extra_id ? 'extra_split' : 'service_split',checkout.marketplace_fee,checkout.professional_amount,payment.updatedAt])
        await db.query(`insert into public.payment_events(payment_id,provider,provider_event_id,event_type,raw_payload) values($1,'mercadopago',$2,$3,$4) on conflict(provider,provider_event_id) do nothing`,
          [projection.rows[0].id,eventId,payment.status,JSON.stringify({ checkout_id: checkout.id, provider_payment_id: payment.paymentId, provider_updated_at: payment.updatedAt, refunded_amount: payment.refundedAmount, provider_fee: payment.providerFee, net_received_amount: payment.netReceived })])
      }
    }
    return { status }
  })
}

export async function prepareCheckout(customerId: string, jobId: string, extraId: string | undefined, liveMode: boolean) {
  if (process.env.MERCADOPAGO_ORDERS_ENABLED !== 'true') {
    const result = await paymentDatabase().query<CheckoutRow>(
      'select * from private.prepare_marketplace_checkout($1,$2,$3,$4)',
      [customerId,jobId,extraId ?? null,liveMode])
    return result.rows[0]
  }
  return paymentTransaction(async db => {
    const result = await db.query<CheckoutRow>(
      'select * from private.prepare_marketplace_checkout($1,$2,$3,$4)',
      [customerId,jobId,extraId ?? null,liveMode])
    const checkout = result.rows[0]
    if (checkout.checkout_protocol === 'orders' || checkout.preference_id ||
        (checkout as CheckoutRow & { preference_spec?: unknown }).preference_spec ||
        checkout.status !== 'creating') return checkout
    const promoted = await db.query<CheckoutRow>(`update public.marketplace_checkouts
      set checkout_protocol='orders',updated_at=now()
      where id=$1 and checkout_protocol='preferences' and preference_id is null
        and preference_spec is null
        and status='creating' and closed_for_new_payments_at is null
        and lease_token is null and not exists (
          select 1 from private.financial_exception_cases f
          where f.job_id=public.marketplace_checkouts.job_id
            and f.status in ('waiting_reconciliation','ready'))
      returning *`, [checkout.id])
    return promoted.rows[0] ?? checkout
  })
}

export async function claimCheckout(id: string, origin: string) {
  return paymentTransaction(async db => {
    const result = await db.query<CheckoutRow & { preference_spec: CreatePreferenceInput | null; active_financial_exception: boolean }>(
      `select c.*,exists(select 1 from private.financial_exception_cases f
        where f.job_id=c.job_id and f.status in ('waiting_reconciliation','ready')) as active_financial_exception
        from public.marketplace_checkouts c where c.id=$1 for update of c`, [id])
    const checkout = result.rows[0]
    if (!checkout) throw new Error('payment_forbidden')
    const protocol = checkoutProtocol(checkout)
    if (checkout.closed_for_new_payments_at || checkout.active_financial_exception ||
        ['approved','refunded','partially_refunded','charged_back','review'].includes(checkout.status) ||
        (protocol === 'orders' && checkout.status === 'rejected')) throw new Error('checkout_review')
    if (['pending','in_process'].includes(checkout.status)) throw new Error('checkout_pending')
    if (checkout.expires_at.getTime() <= Date.now()) throw new Error('checkout_expired')
    if (protocol === 'preferences' ? checkout.preference_id : checkout.order_id)
      return { checkout, token: null, spec: null }
    if (checkout.lease_until && checkout.lease_until.getTime() > Date.now()) throw new Error('checkout_busy')
    const token = randomUUID()
    if (protocol === 'orders') {
      await db.query("update public.marketplace_checkouts set lease_token=$2,lease_until=now()+interval '90 seconds',last_error=null where id=$1", [id,token])
      return { checkout, token, spec: null }
    }
    const amounts = checkoutAmounts(checkout.amount,checkout.marketplace_fee)
    const returnUrl = `${origin}/app/trabajos/${checkout.job_id}`
    const spec: CreatePreferenceInput = checkout.preference_spec ?? {
      sellerId: checkout.professional_id, externalReference: checkout.id, idempotencyKey: checkout.id,
      marketplaceFee: amounts.fee, items: [{ id: checkout.extra_id ?? checkout.job_id, title: checkout.extra_id ? 'Adicional aceptado Lysto' : 'Servicio técnico Lysto', currencyId: 'ARS', quantity: 1, unitPrice: amounts.total }],
      backUrls: { success: `${returnUrl}?pago=retorno`, pending: `${returnUrl}?pago=pendiente`, failure: `${returnUrl}?pago=reintentar` },
      autoReturn: 'approved', metadata: { lysto_checkout_id: checkout.id, lysto_created_at: checkout.created_at.toISOString() },
      expiresAt: checkout.expires_at,
    }
    // Dates in persisted JSON are revived only at the SDK boundary.
    spec.expiresAt = new Date(spec.expiresAt!)
    await db.query('update public.marketplace_checkouts set preference_spec=$2,lease_token=$3,lease_until=now()+interval \'90 seconds\',last_error=null where id=$1', [id,JSON.stringify(spec),token])
    return { checkout, token, spec }
  })
}
