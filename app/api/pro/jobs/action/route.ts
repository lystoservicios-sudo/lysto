import { NextResponse } from 'next/server'
import { applyProfessionalJobAction, type ProfessionalJobCommand } from '@/lib/use-cases/professional-workflow'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as ProfessionalJobCommand | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  try {
    const transition = applyProfessionalJobAction(body)
    return NextResponse.json({
      accepted: true,
      transition,
      persistence: 'Verify assigned professional ownership, persist jobs.status and job_status_events atomically.'
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
