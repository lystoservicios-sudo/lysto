import { NextResponse } from 'next/server'
import { classifySupportCase } from '@/lib/quality/support'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { reason?: string; description?: string; jobId?: string } | null
  if (!body?.reason || !body.jobId) return NextResponse.json({ error: 'Invalid quality case payload' }, { status: 400 })
  const classification = classifySupportCase({ reason: body.reason, description: body.description ?? '' })
  return NextResponse.json({ opened: true, classification, status: 'ready_for_quality_event_insert_and_admin_notification' })
}
