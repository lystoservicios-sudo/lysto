import 'server-only'

import { z } from 'zod'

import { buildCustomerDashboardViewModel } from '@/features/customer/dashboard-view-model'
import type {
  CustomerEquipmentViewModel,
  CustomerJobViewModel,
  CustomerMaintenanceViewModel,
  CustomerRequestViewModel,
  CustomerStatusViewModel,
  CustomerWarrantyViewModel
} from '@/features/customer/view-models'
import type { Session } from '@/lib/auth/session'
import {
  listCustomerAddresses,
  listCustomerEquipment,
  readCustomerProfile
} from '@/lib/customer-assets/service'
import { createCustomerQueries } from '@/lib/data-access/customer-queries'
import type { ReadOptions, RequestDto } from '@/lib/data-access/read-contracts'
import { customerJobStatusLabels } from '@/lib/domain/job-status-labels'
import type { JobStatus, RequestStatus, ServiceIssueSlug } from '@/lib/domain/types'
import { listMaintenance } from '@/lib/equipment/maintenance-service'
import { ApiError } from '@/lib/http/api-error'

const terminalJobs = new Set<JobStatus>([
  'completed',
  'cancelled_by_customer',
  'cancelled_by_professional',
  'cancelled_by_admin'
])
const requestLabels: Record<RequestStatus, string> = {
  draft: 'Borrador',
  diagnosis_completed: 'Diagnóstico preliminar listo',
  address_completed: 'Dirección confirmada',
  schedule_completed: 'Horario confirmado',
  price_selected: 'Precio seleccionado',
  pending_payment: 'Pago pendiente',
  payment_approved: 'Pago aprobado',
  matching: 'Buscando profesional',
  pending_assignment: 'Pendiente de asignación',
  pending_professional_acceptance: 'Esperando confirmación profesional',
  assigned: 'Asignada',
  cancelled: 'Cancelada',
  expired: 'Vencida'
}
const requestAttention = new Set<RequestStatus>(['pending_payment'])
const requestDone = new Set<RequestStatus>(['payment_approved', 'assigned'])

function requestStatus(status: RequestStatus): CustomerStatusViewModel {
  return {
    label: requestLabels[status],
    tone: requestAttention.has(status)
      ? 'warning'
      : requestDone.has(status)
        ? 'success'
        : status === 'cancelled' || status === 'expired'
          ? 'neutral'
          : 'brand'
  }
}
function jobStatus(status: JobStatus): CustomerStatusViewModel {
  return {
    label: customerJobStatusLabels[status],
    tone:
      status === 'completed'
        ? 'success'
        : status === 'waiting_customer_approval' ||
            status === 'completed_pending_customer_confirmation'
          ? 'warning'
          : terminalJobs.has(status)
            ? 'neutral'
            : status === 'disputed'
              ? 'danger'
              : 'brand'
  }
}
function addressLabel(address?: { street: string; number: string; city: string }) {
  return address
    ? `${address.street} ${address.number}, ${address.city}`
    : 'Dirección por confirmar'
}
function requestNext(status: RequestStatus) {
  if (status === 'draft') return 'Continuar la solicitud'
  if (status === 'pending_payment') return 'Completar el pago'
  if (
    status === 'matching' ||
    status === 'pending_assignment' ||
    status === 'pending_professional_acceptance'
  )
    return 'Esperar la asignación profesional'
  if (status === 'assigned') return 'Seguir el trabajo confirmado'
  if (status === 'cancelled' || status === 'expired')
    return 'Crear una nueva solicitud si todavía necesitás ayuda'
  return 'Completar el próximo paso de la solicitud'
}
function jobNext(status: JobStatus) {
  if (status === 'waiting_customer_approval') return 'Revisar y decidir el presupuesto adicional'
  if (status === 'completed_pending_customer_confirmation')
    return 'Confirmar el resultado o informar un problema'
  if (status === 'completed') return 'Consultar el comprobante o calificar el servicio'
  if (status === 'pending_assignment' || status === 'pending_professional_acceptance')
    return 'Esperar la confirmación del profesional'
  if (status === 'confirmed') return 'Esperar la visita programada'
  if (status === 'technician_on_way') return 'Preparar el acceso al domicilio'
  if (status === 'disputed' || status === 'warranty_claim') return 'Seguir el caso con soporte'
  if (terminalJobs.has(status)) return 'El trabajo está cerrado'
  return 'Seguir el estado del servicio'
}

async function references(session: Session, requests: RequestDto[]) {
  const issueIds = [...new Set(requests.map((item) => item.issueTypeId))]
  const [addresses, issues] = await Promise.all([
    listCustomerAddresses(session, { pageSize: 100 }),
    issueIds.length
      ? session.client.from('service_issue_types').select('id,slug,name').in('id', issueIds)
      : Promise.resolve({ data: [], error: null })
  ])
  if (issues.error || !issues.data) throw new ApiError('service_unavailable')
  return {
    addresses: new Map(addresses.items.map((item) => [item.id, item])),
    issues: new Map(issues.data.map((item) => [item.id, item]))
  }
}

export async function listCustomerRequestsLive(session: Session, input: ReadOptions = {}) {
  const page = await createCustomerQueries(session.client).list('requests', input)
  const refs = await references(session, page.items)
  const items = page.items.map((item): CustomerRequestViewModel => {
    const issue = refs.issues.get(item.issueTypeId)
    return {
      id: item.id,
      issue: (issue?.slug ?? 'mantenimiento') as ServiceIssueSlug,
      issueLabel: issue?.name ?? 'Servicio técnico',
      status: item.status,
      statusView: requestStatus(item.status),
      urgency: item.urgency ?? 'flexible',
      address: addressLabel(item.addressId ? refs.addresses.get(item.addressId) : undefined),
      preferredWindow:
        [item.preferredDate, item.preferredWindow].filter(Boolean).join(' · ') ||
        'Horario por confirmar',
      createdAt: item.createdAt,
      preliminaryDiagnosis: 'Consultá el detalle para ver la información confirmada.',
      preliminaryPrice: null,
      mediaCount: 0,
      nextStep: requestNext(item.status)
    }
  })
  return { ...page, items }
}

export async function listCustomerJobsLive(session: Session, input: ReadOptions = {}) {
  const page = await createCustomerQueries(session.client).list('jobs', input)
  const requestIds = [...new Set(page.items.map((item) => item.requestId))]
  const requestResult = requestIds.length
    ? await session.client
        .from('service_requests')
        .select(
          'id,created_at,status,issue_type_id,address_id,equipment_id,preferred_date,preferred_time_window,urgency_level'
        )
        .in('id', requestIds)
    : { data: [], error: null }
  if (requestResult.error || !requestResult.data) throw new ApiError('service_unavailable')
  const requests: RequestDto[] = requestResult.data.map((item) => ({
    id: item.id,
    createdAt: item.created_at,
    status: item.status,
    issueTypeId: item.issue_type_id,
    addressId: item.address_id,
    equipmentId: item.equipment_id,
    preferredDate: item.preferred_date,
    preferredWindow: item.preferred_time_window,
    urgency: item.urgency_level
  }))
  const refs = await references(session, requests)
  const requestMap = new Map(requests.map((item) => [item.id, item]))
  const items = page.items.map((item): CustomerJobViewModel => {
    const request = requestMap.get(item.requestId)
    const issue = request ? refs.issues.get(request.issueTypeId) : undefined
    return {
      id: item.id,
      requestId: item.requestId,
      equipmentId: request?.equipmentId ?? undefined,
      status: item.status,
      statusView: jobStatus(item.status),
      issueLabel: issue?.name ?? 'Servicio técnico',
      address: addressLabel(request?.addressId ? refs.addresses.get(request.addressId) : undefined),
      scheduledAt: item.scheduledDate ?? item.createdAt,
      timeWindow: item.timeWindow ?? 'Horario por confirmar',
      amount: item.finalAmount,
      finalAmount: item.finalAmount,
      nextStep: jobNext(item.status),
      canReview: item.status === 'completed',
      completedAt: item.completedAt ?? undefined
    }
  })
  return { ...page, items }
}

export async function customerLiveData(session: Session) {
  const [profile, jobPage, equipmentPage, maintenancePlans, claims] = await Promise.all([
    readCustomerProfile(session),
    listCustomerJobsLive(session, { pageSize: 100 }),
    listCustomerEquipment(session, { pageSize: 100 }),
    listMaintenance(session),
    createCustomerQueries(session.client).list('claims', { pageSize: 100 })
  ])
  const jobs = jobPage.items
  const equipment = equipmentPage.items.map(
    (item): CustomerEquipmentViewModel => ({
      id: item.id,
      nickname: item.nickname,
      kind: item.equipmentType ?? 'Equipo',
      brand: item.brand ?? 'Marca no informada',
      model: item.model ?? undefined,
      address: 'Dirección registrada',
      maintenanceOption: 'none',
      serviceCount: 0
    })
  )
  const equipmentMap = new Map(equipment.map((item) => [item.id, item]))
  for (const job of jobs) {
    if (job.equipmentId) job.equipmentName = equipmentMap.get(job.equipmentId)?.nickname
  }
  const maintenance = maintenancePlans.map(
    (item): CustomerMaintenanceViewModel => ({
      id: item.id,
      equipmentId: item.equipmentId,
      equipmentName: item.equipmentName,
      recommendation: item.recommendation.replaceAll('_', ' '),
      dueAt: item.dueAt ?? undefined,
      urgency: !item.dueAt
        ? 'none'
        : item.dueAt < new Date().toISOString().slice(0, 10)
          ? 'overdue'
          : 'planned',
      actionState:
        item.status === 'suppressed_by_case' || item.status === 'cancelled'
          ? 'disabled'
          : item.status === 'deferred'
            ? 'deferred'
            : 'available'
    })
  )
  const jobMap = new Map(jobs.map((item) => [item.id, item]))
  const warrantyResult = jobs.length
    ? await session.client
        .from('jobs')
        .select('id,warranty_until')
        .in(
          'id',
          jobs.map((job) => job.id)
        )
    : { data: [], error: null }
  if (warrantyResult.error || !warrantyResult.data) throw new ApiError('service_unavailable')
  const warrantyByJob = new Map(warrantyResult.data.map((item) => [item.id, item.warranty_until]))
  const warranties: CustomerWarrantyViewModel[] = []
  for (const job of jobs) {
    const warrantyUntil = warrantyByJob.get(job.id)
    if (!warrantyUntil) continue
    const active = warrantyUntil >= new Date().toISOString().slice(0, 10)
    warranties.push({
      id: `warranty-${job.id}`,
      jobId: job.id,
      equipmentId: job.equipmentId,
      equipmentName: job.equipmentName ?? 'Equipo del servicio',
      status: active ? 'active' : 'expired',
      statusView: {
        label: active ? 'Cobertura vigente' : 'Cobertura finalizada',
        tone: active ? 'success' : 'neutral'
      },
      coverageEndsAt: warrantyUntil,
      safeSummary: 'Cobertura registrada para este trabajo.',
      nextStep: active
        ? 'Podés informar un problema desde esta sección.'
        : 'La cobertura registrada ya finalizó.',
      serviceLabel: job.issueLabel,
      completedAt: job.completedAt
    })
  }
  for (const claim of claims.items) {
    const job = jobMap.get(claim.jobId)
    warranties.push({
      id: claim.id,
      jobId: claim.jobId,
      equipmentId: job?.equipmentId,
      equipmentName: job?.equipmentName ?? 'Equipo del servicio',
      status:
        claim.status === 'approved' || claim.status === 'open'
          ? 'claim_open'
          : claim.status === 'completed'
            ? 'resolved'
            : 'rejected',
      statusView: {
        label:
          claim.status === 'open'
            ? 'En revisión'
            : claim.status === 'approved'
              ? 'Cobertura aprobada'
              : claim.status === 'completed'
                ? 'Resuelto'
                : 'No cubierto',
        tone:
          claim.status === 'completed'
            ? 'success'
            : claim.status === 'rejected'
              ? 'neutral'
              : 'warning'
      },
      safeSummary: claim.description,
      nextStep: claim.resolution ?? 'Seguí las novedades del caso desde soporte.',
      claimOpenedAt: claim.createdAt
    })
  }
  return {
    profile,
    jobs,
    equipment,
    maintenance,
    warranties,
    dashboard: buildCustomerDashboardViewModel({
      customerName: profile.firstName,
      jobs,
      equipment,
      maintenance,
      warranties
    })
  }
}

export async function customerReviewEligibility(session: Session, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null
  const job = await createCustomerQueries(session.client).detail('jobs', id)
  if (!job) return null
  const { data, error } = await session.client
    .from('reviews')
    .select('id')
    .eq('job_id', id)
    .maybeSingle()
  if (error) throw new ApiError('service_unavailable')
  return {
    eligible: job.status === 'completed',
    alreadyReviewed: Boolean(data)
  }
}
