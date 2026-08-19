type SupabaseClientLike = { rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> }

export async function assignProfessionalTransaction(supabase: SupabaseClientLike, input: { jobId: string; requestId: string; professionalId: string; adminProfileId: string }) {
  const { data, error } = await supabase.rpc('assign_professional_to_job', {
    p_job_id: input.jobId,
    p_request_id: input.requestId,
    p_professional_id: input.professionalId,
    p_admin_profile_id: input.adminProfileId
  })
  if (error) throw new Error(`assignProfessionalTransaction:${error.message}`)
  return data
}

export async function professionalRespondTransaction(supabase: SupabaseClientLike, input: { jobId: string; professionalId: string; response: 'accepted' | 'rejected'; reason?: string }) {
  const { data, error } = await supabase.rpc('professional_respond_to_job', {
    p_job_id: input.jobId,
    p_professional_id: input.professionalId,
    p_response: input.response,
    p_reason: input.reason ?? null
  })
  if (error) throw new Error(`professionalRespondTransaction:${error.message}`)
  return data
}

export async function closeJobTransaction(supabase: SupabaseClientLike, input: { jobId: string; equipmentId: string; realDiagnosis: string; workDone: string; partsUsed?: string; finalState: string; maintenanceOption: string; nextMaintenanceDate?: string; warrantyDays: number; internalNotes?: string }) {
  const { data, error } = await supabase.rpc('close_job_with_final_report', {
    p_job_id: input.jobId,
    p_equipment_id: input.equipmentId,
    p_real_diagnosis: input.realDiagnosis,
    p_work_done: input.workDone,
    p_parts_used: input.partsUsed ?? null,
    p_final_state: input.finalState,
    p_maintenance_option: input.maintenanceOption,
    p_next_maintenance_date: input.nextMaintenanceDate ?? null,
    p_warranty_days: input.warrantyDays,
    p_internal_notes: input.internalNotes ?? null
  })
  if (error) throw new Error(`closeJobTransaction:${error.message}`)
  return data
}
