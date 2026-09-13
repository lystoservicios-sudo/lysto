import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { nullableRpcArgument } from '@/lib/supabase/rpc-arguments'
import { defaultWarrantyDays, validateJobFinalReport } from './final-report'

const maintenance = z.enum([
  'none',
  'filters_30_days',
  'filters_60_days',
  'filters_90_days',
  'deep_cleaning_6_months',
  'deep_cleaning_annual',
  'gas_review_30_days',
  'outdoor_unit_review',
  'electrical_review',
  'pending_part_replacement',
  'second_visit_recommended'
])
export const closeoutInput = z
  .object({
    jobId: z.string().uuid(),
    equipmentId: z.string().uuid(),
    realDiagnosis: z.string().trim().min(8).max(3000),
    workDone: z.string().trim().min(8).max(3000),
    partsUsed: z.array(z.string().trim().min(2).max(300)).max(30).default([]),
    resolutionStatus: z.enum([
      'resolved',
      'partially_resolved',
      'pending_part',
      'second_visit_required',
      'not_resolved'
    ]),
    maintenanceOption: maintenance,
    nextMaintenanceDate: z.string().date().optional(),
    warrantyDays: z.number().int().min(0).max(365).optional(),
    internalNotes: z.string().trim().max(3000).optional(),
    afterPhotoIds: z
      .array(z.string().uuid())
      .min(1)
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length),
    idempotencyKey: z.string().uuid()
  })
  .strict()
const result = z.object({
  jobId: z.string().uuid(),
  finalReportId: z.string().uuid(),
  status: z.literal('completed_pending_customer_confirmation'),
  version: z.number().int().positive(),
  idempotent: z.boolean(),
  evidenceCount: z.number().int().positive().optional()
})

export async function closeJob(session: Session, raw: unknown) {
  const input = closeoutInput.parse(raw)
  const validation = validateJobFinalReport(
    { ...input, photosAfterCount: input.afterPhotoIds.length },
    new Date()
  )
  if (!validation.ok) throw new ApiError('invalid_input')
  const finalState =
    input.resolutionStatus === 'second_visit_required'
      ? 'requires_second_visit'
      : input.resolutionStatus
  const response = await session.client.rpc('close_job_with_final_report', {
    p_job_id: input.jobId,
    p_equipment_id: input.equipmentId,
    p_real_diagnosis: input.realDiagnosis,
    p_work_done: input.workDone,
    p_parts_used: nullableRpcArgument(input.partsUsed.length ? input.partsUsed.join('\n') : null),
    p_final_state: finalState,
    p_maintenance_option: input.maintenanceOption,
    p_next_maintenance_date: nullableRpcArgument(input.nextMaintenanceDate ?? null),
    p_warranty_days: input.warrantyDays ?? defaultWarrantyDays(input.resolutionStatus),
    p_internal_notes: nullableRpcArgument(input.internalNotes ?? null),
    p_after_photo_ids: input.afterPhotoIds,
    p_idempotency_key: input.idempotencyKey
  })
  if (response.error) {
    if (response.error.code === '40001') throw new ApiError('conflict')
    if (response.error.code === 'P0002') throw new ApiError('not_found')
    if (response.error.code === '22023') throw new ApiError('invalid_input')
    if (response.error.code === '42501') throw new ApiError('forbidden')
    throw new ApiError('service_unavailable')
  }
  return result.parse(response.data)
}
