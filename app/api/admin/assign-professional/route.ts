import { NextResponse } from 'next/server'
import { z } from 'zod'
import { decideProfessionalAssignment, type AssignmentInput } from '../../../../lib/admin/assignment'
import { professionals } from '../../../../lib/mock/lysto-data'

const assignmentRequestSchema = z.object({
  requestId: z.string().trim().min(1),
  jobId: z.string().trim().min(1).optional(),
  adminProfileId: z.string().trim().min(1).optional(),
  paid: z.boolean(),
  currentJobStatus: z.enum([
    'pending_assignment',
    'pending_professional_acceptance',
    'confirmed',
    'technician_on_way',
    'arrived',
    'onsite_diagnosis',
    'waiting_customer_approval',
    'in_progress',
    'completed_pending_customer_confirmation',
    'completed',
    'cancelled_by_customer',
    'cancelled_by_professional',
    'cancelled_by_admin',
    'disputed',
    'warranty_claim'
  ]).optional(),
  selectedProfessionalId: z.string().trim().min(1).optional(),
  override: z.boolean().optional().default(false)
}).strict().superRefine((body, context) => {
  if (!body.override) return
  if (!body.selectedProfessionalId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedProfessionalId'], message: 'selectedProfessionalId is required for manual assignment' })
  }
  if (!body.adminProfileId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['adminProfileId'], message: 'adminProfileId is required for manual assignment' })
  }
})

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null)
  const parsed = assignmentRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid assignment payload', errors: parsed.error.issues.map((issue) => issue.message) }, { status: 400 })
  }
  const body = parsed.data

  // TODO: Replace mock professionals with repository-backed candidates.
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

  const assignment: AssignmentInput = {
    requestId: body.requestId,
    jobId: body.jobId,
    requestStatus: 'pending_assignment',
    currentJobStatus: body.currentJobStatus,
    paid: body.paid,
    candidates,
    selectedProfessionalId: body.override ? body.selectedProfessionalId : undefined,
    mode: body.override ? 'manual' : 'auto_suggested',
    adminProfileId: body.adminProfileId
  }
  const result = decideProfessionalAssignment(assignment)
  if (!result.ok) {
    return NextResponse.json({ error: 'Assignment failed', errors: result.errors, ranking: result.ranking }, { status: 400 })
  }
  return NextResponse.json({ assigned: true, assignedProfessionalId: result.assignedProfessionalId, ranking: result.ranking, status: 'ready_for_db_transaction_and_audit_log' })
}
