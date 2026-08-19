import { NextResponse } from 'next/server'
import { normalizePaymentStatus } from '@/lib/payments/idempotency'

export async function POST(request: Request) {
  const providerEventId = request.headers.get('x-request-id') ?? request.headers.get('x-signature') ?? crypto.randomUUID()
  const payload = await request.json().catch(() => null) as { id?: string; type?: string; action?: string; data?: { id?: string }; status?: string } | null
  if (!payload?.id && !payload?.data?.id) return NextResponse.json({ error: 'Invalid Mercado Pago webhook payload' }, { status: 400 })
  const providerPaymentId = payload.data?.id ?? payload.id!
  const status = normalizePaymentStatus(payload.status ?? 'pending')
  return NextResponse.json({
    received: true,
    providerEventId,
    providerPaymentId,
    normalizedStatus: status,
    idempotency: 'Store providerEventId in payment_events with unique(provider, provider_event_id) before mutating payments.'
  })
}
