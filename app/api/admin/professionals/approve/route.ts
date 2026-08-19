import { NextResponse } from 'next/server'
import { evaluateProfessionalOnboarding, type OnboardingApplication } from '@/lib/use-cases/professional-workflow'
import { createAuditEvent } from '@/lib/admin/audit-events'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as (OnboardingApplication & { adminProfileId?: string }) | null
  if (!body?.adminProfileId) return NextResponse.json({ error: 'adminProfileId is required' }, { status: 400 })
  try {
    const readiness = evaluateProfessionalOnboarding({ ...body, currentStatus: 'under_review' })
    if (!readiness.readyForApproval) return NextResponse.json({ error: 'professional_not_ready_for_approval', missing: readiness.missing }, { status: 400 })
    return NextResponse.json({
      approved: true,
      professionalId: body.professionalId,
      nextStatus: readiness.nextStatus,
      auditEvent: createAuditEvent({ action: 'professional.approved', actorProfileId: body.adminProfileId, entityType: 'professional_profile', entityId: body.professionalId })
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
