import { NextResponse } from 'next/server'
import { prepareCustomerServiceRequest, type CustomerRequestCommand } from '@/lib/use-cases/customer-request'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as CustomerRequestCommand | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  try {
    const prepared = prepareCustomerServiceRequest(body)
    return NextResponse.json({
      accepted: true,
      request: prepared,
      persistence: 'Persist service_requests, request_answers, request_media, diagnosis_reports and price_options in one transaction before payment.'
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
