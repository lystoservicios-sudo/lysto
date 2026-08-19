import { NextResponse } from 'next/server'
import type { JobStatus } from '@/lib/domain/types'
import { transitionJobStatus } from '@/lib/jobs/workflow'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { current?: JobStatus; next?: JobStatus; hasFinalReport?: boolean; customerApproved?: boolean } | null
  if (!body?.current || !body.next) return NextResponse.json({ error: 'Invalid job status payload' }, { status: 400 })
  try {
    const nextStatus = transitionJobStatus(body.current, body.next, { hasFinalReport: body.hasFinalReport, customerApproved: body.customerApproved })
    return NextResponse.json({ nextStatus, status: 'ready_for_job_status_event_insert' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid transition' }, { status: 400 })
  }
}
