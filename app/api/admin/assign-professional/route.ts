import { NextResponse } from 'next/server'
import { decideProfessionalAssignment } from '@/lib/admin/assignment'
import { professionals } from '@/lib/mock/lysto-data'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { requestPaid?: boolean; professionalId?: string; override?: boolean } | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  const candidates = professionals.map((professional) => ({
    id: professional.id,
    name: professional.name,
    status: professional.status === 'approved' ? 'approved' as const : professional.status === 'suspended' ? 'suspended' as const : 'under_review' as const,
    serviceSlugs: ['aire_acondicionado'],
    zones: ['caba'],
    available: professional.status === 'approved',
    hasLicense: professional.hasLicense,
    toolsScore: professional.toolsScore,
    ratingAvg: professional.rating,
    jobsCompleted: professional.jobsCompleted,
    activeJobs: 0,
    acceptanceRate: professional.acceptanceRate,
    distanceKm: 5,
    internalScore: professional.score
  }))
  const result = decideProfessionalAssignment({ requestPaid: Boolean(body.requestPaid), requestStatus: 'pending_assignment', jobStatus: 'pending_assignment', candidates, overrideProfessionalId: body.override ? body.professionalId : undefined })
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 })
  return NextResponse.json({ assigned: true, professional: result.professional, candidates: result.candidates, status: 'ready_for_db_transaction_and_audit_log' })
}
