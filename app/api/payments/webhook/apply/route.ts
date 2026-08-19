import { NextResponse } from 'next/server'
import { applyPaymentWebhook } from '@/lib/use-cases/payment-flow'
import type { PaymentStatus } from '@/lib/domain/types'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { event?: { id?: string; type?: string; data?: { id?: string }; status?: PaymentStatus }; currentStatus?: PaymentStatus; storedEventIds?: string[] } | null
  if (!body?.event?.id || !body.currentStatus) return NextResponse.json({ error: 'Invalid payment webhook application payload' }, { status: 400 })
  try {
    const application = applyPaymentWebhook({
      event: { id: body.event.id, type: body.event.type ?? 'payment', data: body.event.data, status: body.event.status },
      currentStatus: body.currentStatus,
      storedEvents: (body.storedEventIds ?? []).map((providerEventId) => ({ providerEventId }))
    })
    return NextResponse.json({ application })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
