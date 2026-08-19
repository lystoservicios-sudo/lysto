import { NextResponse } from 'next/server'
import { createPaymentPreferenceDraft } from '@/lib/use-cases/payment-flow'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { requestId?: string; customerId?: string; amount?: number; option?: 'flexible' | 'priority' } | null
  if (!body?.requestId || !body.customerId || !body.amount || body.amount <= 0) return NextResponse.json({ error: 'Invalid payment preference payload' }, { status: 400 })
  try {
    const draft = createPaymentPreferenceDraft({ requestId: body.requestId, customerId: body.customerId, amount: body.amount, selectedOption: body.option ?? 'flexible', platformFeeRate: Number(process.env.LYSTO_DEFAULT_PLATFORM_FEE_RATE ?? 0.18) })
    // MVP contract: replace mockPreferenceId/initPoint with real Mercado Pago preference after credentials are configured.
    return NextResponse.json({ preferenceId: `mock-pref-${body.requestId}`, initPoint: null, payment: draft, status: 'mocked_until_credentials_are_configured' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
