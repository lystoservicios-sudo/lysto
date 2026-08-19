import { NextResponse } from 'next/server'
import { professionalRespondToAssignment } from '@/lib/professional/request-response'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { actorProfessionalId?: string; assignedProfessionalId?: string; response?: 'accepted' | 'rejected'; rejectionReason?: string } | null
  if (!body?.actorProfessionalId || !body.assignedProfessionalId || !body.response) return NextResponse.json({ error: 'Invalid response payload' }, { status: 400 })
  const result = professionalRespondToAssignment({ requestStatus: 'pending_professional_acceptance', jobStatus: 'pending_professional_acceptance', actorProfessionalId: body.actorProfessionalId, assignedProfessionalId: body.assignedProfessionalId, response: body.response, rejectionReason: body.rejectionReason })
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 })
  return NextResponse.json({ accepted: body.response === 'accepted', nextRequestStatus: result.requestStatus, nextJobStatus: result.jobStatus, status: 'ready_for_db_transaction_and_notification' })
}
