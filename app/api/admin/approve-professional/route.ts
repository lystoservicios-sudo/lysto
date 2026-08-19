import { NextResponse } from 'next/server'
import { decideProfessionalApproval, type ProfessionalApprovalInput } from '@/lib/admin/professional-approval'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as ProfessionalApprovalInput | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  const decision = decideProfessionalApproval(body)
  if (!decision.ok) return NextResponse.json({ error: 'Professional approval rejected', details: decision.errors, score: decision.score }, { status: 400 })
  return NextResponse.json({ decision, persistence: 'Update professional_profiles.status, write audit log, notify professional.' })
}
