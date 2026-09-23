import 'server-only'

import { z } from 'zod'

import type { Session } from '@/lib/auth/session'
import { createProfessionalQueries } from '@/lib/data-access/professional-queries'
import type { ReadOptions } from '@/lib/data-access/read-contracts'
import { customerJobStatusLabels } from '@/lib/domain/job-status-labels'
import { ApiError } from '@/lib/http/api-error'

export type ProfessionalLiveJob = {
  id: string
  status: string
  statusLabel: string
  scheduledDate: string
  timeWindow: string
  issueLabel: string
  address: string
  finalAmount: number | null
}

export async function listProfessionalJobsLive(session: Session, input: ReadOptions = {}) {
  const page = await createProfessionalQueries(session.client).list('jobs', input)
  const requestIds = [...new Set(page.items.map((item) => item.requestId))]
  const requests = requestIds.length
    ? await session.client
        .from('service_requests')
        .select('id,issue_type_id,address_id')
        .in('id', requestIds)
    : { data: [], error: null }
  if (requests.error || !requests.data) throw new ApiError('service_unavailable')
  const issueIds = [...new Set(requests.data.map((item) => item.issue_type_id))]
  const addressIds = [
    ...new Set(requests.data.flatMap((item) => (item.address_id ? [item.address_id] : [])))
  ]
  const [issues, addresses] = await Promise.all([
    issueIds.length
      ? session.client.from('service_issue_types').select('id,name').in('id', issueIds)
      : Promise.resolve({ data: [], error: null }),
    addressIds.length
      ? session.client
          .from('customer_addresses')
          .select('id,street,number,city')
          .in('id', addressIds)
      : Promise.resolve({ data: [], error: null })
  ])
  if (issues.error || addresses.error || !issues.data || !addresses.data)
    throw new ApiError('service_unavailable')
  const requestMap = new Map(requests.data.map((item) => [item.id, item]))
  const issueMap = new Map(issues.data.map((item) => [item.id, item.name]))
  const addressMap = new Map(
    addresses.data.map((item) => [item.id, `${item.street} ${item.number}, ${item.city}`])
  )
  const items = page.items.map((job): ProfessionalLiveJob => {
    const request = requestMap.get(job.requestId)
    return {
      id: job.id,
      status: job.status,
      statusLabel: customerJobStatusLabels[job.status],
      scheduledDate: job.scheduledDate ?? job.createdAt,
      timeWindow: job.timeWindow ?? 'Horario por confirmar',
      issueLabel: request
        ? (issueMap.get(request.issue_type_id) ?? 'Servicio técnico')
        : 'Servicio técnico',
      address: request?.address_id
        ? (addressMap.get(request.address_id) ?? 'Dirección asignada')
        : 'Dirección por confirmar',
      finalAmount: job.finalAmount
    }
  })
  return { ...page, items }
}

export async function readProfessionalLiveProfile(session: Session) {
  const [profile, identity] = await Promise.all([
    session.client
      .from('professional_profiles')
      .select(
        'id,status,rating_avg,jobs_completed,years_experience,acceptance_rate,base_location,has_mobility,mobility_type,license_number,license_expires_at,bio'
      )
      .eq('id', session.professionalId!)
      .single(),
    session.client
      .from('profiles')
      .select('first_name,last_name,email,phone,avatar_url')
      .eq('id', session.profileId)
      .single()
  ])
  if (profile.error || identity.error || !profile.data || !identity.data)
    throw new ApiError('service_unavailable')
  const avatar = identity.data.avatar_url
  let avatarUrl: string | null = null
  try {
    const storage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
    const candidate = new URL(avatar ?? '')
    if (candidate.origin === storage.origin &&
      /^\/storage\/v1\/object\/public\/public-avatars\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/.test(candidate.pathname))
      avatarUrl = candidate.toString()
  } catch { /* Legacy or external URL: never use it as a professional avatar. */ }
  return { ...profile.data, ...identity.data, avatar_url: avatarUrl }
}

export async function readAssignedEquipment(session: Session, equipmentId: string) {
  if (!z.string().uuid().safeParse(equipmentId).success) return null
  const requests = await session.client
    .from('service_requests')
    .select('id')
    .eq('equipment_id', equipmentId)
  if (requests.error || !requests.data) throw new ApiError('service_unavailable')
  const requestIds = requests.data.map((item) => item.id)
  if (!requestIds.length) return null
  const assignment = await session.client
    .from('jobs')
    .select('id')
    .eq('professional_id', session.professionalId!)
    .in('request_id', requestIds)
    .limit(1)
  if (assignment.error) throw new ApiError('service_unavailable')
  if (!assignment.data?.length) return null
  const [equipment, history] = await Promise.all([
    session.client
      .from('customer_equipment')
      .select('id,nickname,equipment_type,brand,model,frigorias')
      .eq('id', equipmentId)
      .maybeSingle(),
    session.client
      .from('equipment_service_records')
      .select('id,created_at,reported_problem,real_diagnosis,work_done,next_maintenance_date')
      .eq('equipment_id', equipmentId)
      .order('created_at', { ascending: false })
      .limit(25)
  ])
  if (equipment.error || history.error) throw new ApiError('service_unavailable')
  return equipment.data ? { equipment: equipment.data, history: history.data ?? [] } : null
}
