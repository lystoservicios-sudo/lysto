import { NextResponse } from 'next/server'
import { generateDiagnosis } from '@/lib/diagnosis/rules'
import type { ServiceIssueSlug, TimeSince } from '@/lib/domain/types'

const validIssues = new Set(['no_enfria', 'pierde_agua', 'hace_ruido', 'no_enciende', 'no_funciona_calor', 'instalacion', 'mantenimiento'])
const validTimeSince = new Set(['today', 'days', 'weeks', 'months'])

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { issue?: ServiceIssueSlug; timeSince?: TimeSince; hasPhoto?: boolean; hasVideo?: boolean } | null
  if (!body || !validIssues.has(String(body.issue)) || !validTimeSince.has(String(body.timeSince))) {
    return NextResponse.json({ error: 'Invalid diagnosis payload' }, { status: 400 })
  }
  return NextResponse.json({ diagnosis: generateDiagnosis({ issue: body.issue!, timeSince: body.timeSince!, hasPhoto: body.hasPhoto, hasVideo: body.hasVideo }) })
}
