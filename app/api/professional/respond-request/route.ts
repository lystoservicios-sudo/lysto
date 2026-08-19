import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleProfessionalResponse, type ProfessionalResponseInput } from '../../../../lib/professional/request-response'

const professionalResponseSchema = z.object({
  actorProfessionalId: z.string().trim().min(1),
  assignedProfessionalId: z.string().trim().min(1),
  response: z.enum(['accepted', 'rejected']),
  rejectionReason: z.string().trim().optional()
}).strict()

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null)
  const parsed = professionalResponseSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid response payload', errors: parsed.error.issues.map((issue) => issue.message) }, { status: 400 })
  }
  const body = parsed.data
  const professionalResponse: ProfessionalResponseInput = {
    requestStatus: 'pending_professional_acceptance',
    jobStatus: 'pending_professional_acceptance',
    professionalId: body.actorProfessionalId,
    assignedProfessionalId: body.assignedProfessionalId,
    response: body.response === 'accepted' ? 'accept' : 'reject',
    reason: body.rejectionReason
  }
  const result = handleProfessionalResponse(professionalResponse)
  if (!result.ok) return NextResponse.json({ error: 'Professional response failed', errors: result.errors }, { status: 400 })
  return NextResponse.json({ accepted: body.response === 'accepted', nextRequestStatus: result.nextRequestStatus, nextJobStatus: result.nextJobStatus, status: 'ready_for_db_transaction_and_notification' })
}
