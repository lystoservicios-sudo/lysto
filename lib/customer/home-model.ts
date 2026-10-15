import 'server-only'

import { z } from 'zod'

import {
  buildCustomerHomeViewModel,
  type CustomerHomeViewModel,
  type HomeCheckoutSource,
  type HomeDataset,
  type HomeEquipmentSource,
  type HomeJobSource,
  type HomeMaintenanceSource,
  type HomeQuoteSource,
  type HomeRequestSource,
  type HomeSupportCaseSource,
  type HomeVisitSource
} from '@/features/customer/home-view-model'
import type { CustomerJobViewModel } from '@/features/customer/view-models'
import type { Session } from '@/lib/auth/session'
import {
  listCustomerAddresses,
  listCustomerEquipment,
  readCustomerProfile
} from '@/lib/customer-assets/service'
import {
  listCustomerJobsLive,
  listCustomerRequestsLive,
  listLastCompletedCustomerJobLive
} from '@/lib/customer/live-model'
import { listMaintenance } from '@/lib/equipment/maintenance-service'
import { ApiError } from '@/lib/http/api-error'
import { listSupportCases } from '@/lib/support/service'
import { isExpiredAutomaticRequest } from '@/lib/jobs/visit-address'

const visitSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    timezone: z.literal('America/Argentina/Buenos_Aires'),
    professionalName: z.string().trim().min(1),
    confirmed: z.literal(true)
  })
  .passthrough()

const quoteProjection = z.object({
  id: z.string().uuid(),
  status: z.string(),
  request_id: z.string().uuid().nullable(),
  expires_at: z.string(),
  created_at: z.string(),
  quote: z
    .object({
      scope: z.string().catch('Aire acondicionado'),
      total: z.coerce.number().nullable().catch(null)
    })
    .passthrough()
})

function failed<T>(label: string): HomeDataset<T> {
  return { state: 'error', label }
}

function ready<T>(items: T[]): HomeDataset<T> {
  return { state: 'ready', items }
}

async function listHomeQuotes(session: Session): Promise<HomeQuoteSource[]> {
  if (!session.customerId) throw new ApiError('forbidden')
  const result = await session.client
    .from('service_quotes')
    .select('id,status,request_id,expires_at,created_at,quote')
    .eq('customer_id', session.customerId)
    .order('created_at', { ascending: false })
    .limit(25)
  if (result.error || !result.data) throw new ApiError('service_unavailable')
  return result.data.map((row) => {
    const quote = quoteProjection.parse(row)
    return {
      id: quote.id,
      requestId: quote.request_id,
      status: quote.status,
      scope: quote.quote.scope,
      total: quote.quote.total,
      expiresAt: quote.expires_at,
      createdAt: quote.created_at
    }
  })
}

async function listHomeCheckouts(session: Session): Promise<HomeCheckoutSource[]> {
  if (!session.customerId) throw new ApiError('forbidden')
  const result = await session.client
    .from('marketplace_checkouts')
    .select('job_id,extra_id,status')
    .eq('customer_id', session.customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (result.error || !result.data) throw new ApiError('service_unavailable')
  return result.data.map((checkout) => ({
    jobId: checkout.job_id,
    extraId: checkout.extra_id,
    status: checkout.status
  }))
}

async function homeVisit(session: Session, jobId: string): Promise<HomeVisitSource | null> {
  const result = await session.client.rpc('get_job_visit', { p_job_id: jobId })
  if (result.error) throw new ApiError('service_unavailable')
  const parsed = visitSchema.nullable().safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  if (!parsed.data) return null
  return {
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    timezone: parsed.data.timezone,
    professionalName: parsed.data.professionalName
  }
}

function homeJobSummary(job: CustomerJobViewModel): HomeJobSource {
  return {
    id: job.id,
    requestId: job.requestId,
    requestStatus: job.requestStatus,
    contractSource: job.contractSource,
    status: job.status,
    issueLabel: job.issueLabel,
    equipmentId: job.equipmentId,
    equipmentName: job.equipmentName,
    nextStep: job.nextStep,
    createdAt: job.createdAt ?? job.scheduledAt,
    completedAt: job.completedAt,
    visit: null,
    visitState: 'ready'
  }
}

async function listHomeCompletedJob(session: Session): Promise<HomeJobSource[]> {
  const job = await listLastCompletedCustomerJobLive(session)
  return job ? [homeJobSummary(job)] : []
}

async function listHomeJobs(session: Session): Promise<HomeJobSource[]> {
  const page = await listCustomerJobsLive(session, { pageSize: 25 })
  return Promise.all(
    page.items.map(async (job): Promise<HomeJobSource> => {
      const common = homeJobSummary(job)
      if (job.status !== 'confirmed' || isExpiredAutomaticRequest({ contractSource: job.contractSource, status: job.requestStatus })) {
        return {
          ...common,
          visit: null,
          visitState: 'ready'
        }
      }
      try {
        return {
          ...common,
          visit: await homeVisit(session, job.id),
          visitState: 'ready'
        }
      } catch {
        return {
          ...common,
          visit: null,
          visitState: 'error'
        }
      }
    })
  )
}

function normalizeSupportCase(
  supportCase: Awaited<ReturnType<typeof listSupportCases>>[number]
): HomeSupportCaseSource {
  const publicEvents = supportCase.events.filter((event) => event.message?.trim())
  const latest = publicEvents.at(-1)
  return {
    id: supportCase.id,
    jobId: supportCase.jobId,
    status: supportCase.status,
    category: supportCase.category,
    summary: latest?.message ?? supportCase.publicResolution ?? supportCase.description,
    updatedAt: latest?.createdAt ?? supportCase.createdAt
  }
}

export async function loadCustomerHome(
  session: Session,
  now = new Date().toISOString()
): Promise<CustomerHomeViewModel> {
  const profile = await readCustomerProfile(session)
  const results = await Promise.allSettled([
    listHomeQuotes(session),
    listCustomerRequestsLive(session, { pageSize: 25 }),
    listHomeJobs(session),
    listHomeCheckouts(session),
    listCustomerAddresses(session, { pageSize: 1 }),
    listCustomerEquipment(session, { pageSize: 100 }),
    listMaintenance(session),
    listSupportCases(session, 25),
    listHomeCompletedJob(session)
  ] as const)

  const [quotes, requests, jobs, checkouts, addresses, equipment, maintenance, supportCases, completedJobs] =
    results
  const requestDataset: HomeDataset<HomeRequestSource> =
    requests.status === 'fulfilled'
      ? ready(
          requests.value.items.map((request) => ({
            id: request.id,
            status: request.status,
            contractSource: request.contractSource,
            issueLabel: request.issueLabel,
            nextStep: request.nextStep,
            createdAt: request.createdAt
          }))
        )
      : failed('solicitudes')
  const maintenanceDataset: HomeDataset<HomeMaintenanceSource> =
    maintenance.status === 'fulfilled'
      ? ready(
          maintenance.value.map((reminder) => ({
            id: reminder.id,
            equipmentId: reminder.equipmentId,
            equipmentName: reminder.equipmentName,
            recommendation: reminder.recommendation,
            dueAt: reminder.dueAt,
            status: reminder.status,
            sourceJobId: reminder.sourceJobId
          }))
        )
      : failed('mantenimientos')
  const equipmentDetails: HomeDataset<HomeEquipmentSource> = equipment.status === 'fulfilled'
    ? ready(equipment.value.items.map((item) => ({ id: item.id, name: item.nickname })))
    : failed('equipos')
  const equipmentNames = new Map(
    equipmentDetails.state === 'ready'
      ? equipmentDetails.items.map((item) => [item.id, item.name])
      : []
  )
  const jobsDataset = (
    result: PromiseSettledResult<HomeJobSource[]>,
    label: string
  ): HomeDataset<HomeJobSource> => result.status === 'fulfilled'
    ? ready(result.value.map((job) => ({
        ...job,
        equipmentName: job.equipmentName ??
          (job.equipmentId ? equipmentNames.get(job.equipmentId) : undefined)
      })))
    : failed(label)

  return buildCustomerHomeViewModel({
    preferenceScope: profile.id,
    now,
    quotes: quotes.status === 'fulfilled' ? ready(quotes.value) : failed('presupuestos'),
    requests: requestDataset,
    jobs: jobsDataset(jobs, 'trabajos'),
    completedJobs: jobsDataset(completedJobs, 'historial'),
    checkouts: checkouts.status === 'fulfilled' ? ready(checkouts.value) : failed('pagos'),
    addresses:
      addresses.status === 'fulfilled' ? ready([addresses.value.total]) : failed('domicilios'),
    equipment:
      equipment.status === 'fulfilled' ? ready([equipment.value.total]) : failed('equipos'),
    equipmentDetails,
    maintenance: maintenanceDataset,
    supportCases:
      supportCases.status === 'fulfilled'
        ? ready(supportCases.value.map(normalizeSupportCase))
        : failed('soporte')
  })
}
