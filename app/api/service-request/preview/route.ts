import { NextResponse } from 'next/server'
import { buildServiceRequestPreview, type CustomerRequestDraft } from '@/lib/service-request/request-contract'
import { validateServiceRequestDraft } from '@/lib/service-request/validation'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as CustomerRequestDraft | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  const validation = validateServiceRequestDraft(body)
  if (!validation.ok) return NextResponse.json({ error: 'Invalid service request draft', details: validation.errors }, { status: 400 })
  const preview = buildServiceRequestPreview(body)
  return NextResponse.json({ preview })
}
