import { NextResponse } from 'next/server'
import { closeProfessionalJob, type FinalCloseoutCommand } from '@/lib/use-cases/professional-workflow'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as FinalCloseoutCommand | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  try {
    const closeout = closeProfessionalJob(body)
    // Contract: real implementation inserts job_final_reports, equipment_service_records, service_guarantees and job_status_events in one DB transaction.
    return NextResponse.json({ accepted: true, closeout, status: 'ready_for_transactional_persistence' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
