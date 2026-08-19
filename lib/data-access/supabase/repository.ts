import type { SupabaseClient } from '@supabase/supabase-js'
import { jobTransitions, paymentTransitions, professionalTransitions, requestTransitions } from '../../domain/state-machine.ts'
import type { JobRecord, LystoRepository, PaymentRecord, ProfessionalRecord, ProfileRecord, ServiceRequestRecord } from '../contracts.ts'

// Generated database types arrive later; until then every PostgREST row is untrusted input.
type QueryResult = { data: unknown; error: { message: string } | null }
type SupabaseLike = Pick<SupabaseClient, 'from'>

type ProfileRow = {
  id: string
  auth_user_id: string | null
  role: ProfileRecord['role']
  email: string
  first_name: string | null
  last_name: string | null
}

type ServiceRequestRow = {
  id: string
  customer_id: string
  status: ServiceRequestRecord['status']
  issue_slug?: string | null
  selected_price_option_id: string | null
  service_issue_types?: { slug: string } | null
}

type JobRow = {
  id: string
  request_id: string
  customer_id: string
  professional_id: string | null
  status: JobRecord['status']
}

type PaymentRow = {
  id: string
  request_id: string | null
  provider: PaymentRecord['provider']
  provider_payment_id: string | null
  status: PaymentRecord['status']
  amount: string | number
}

type ProfessionalRow = {
  id: string
  profile_id: string
  status: ProfessionalRecord['status']
  internal_score: number | null
}

const profileRoles = {
  customer: true,
  professional: true,
  admin: true
} satisfies Readonly<Record<ProfileRecord['role'], true>>

const paymentProviders = {
  mercadopago: true
} satisfies Readonly<Record<PaymentRecord['provider'], true>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expectRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${context} must be an object`)
  return value
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`)
  return value
}

function expectNullableString(value: unknown, field: string): string | null {
  if (value === null) return null
  return expectString(value, field)
}

function expectOptionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) return value
  return expectString(value, field)
}

function isKnownValue<T extends string>(
  value: unknown,
  allowed: Readonly<Record<T, unknown>>
): value is T {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(allowed, value)
}

function expectKnownValue<T extends string>(
  value: unknown,
  allowed: Readonly<Record<T, unknown>>,
  field: string
): T {
  if (!isKnownValue(value, allowed)) throw new Error(`${field} has an invalid value`)
  return value
}

function readProfileRow(value: unknown): ProfileRow {
  const row = expectRecord(value, 'mapProfile:row')
  return {
    id: expectString(row.id, 'mapProfile:id'),
    auth_user_id: expectNullableString(row.auth_user_id, 'mapProfile:auth_user_id'),
    role: expectKnownValue(row.role, profileRoles, 'mapProfile:role'),
    email: expectString(row.email, 'mapProfile:email'),
    first_name: expectNullableString(row.first_name, 'mapProfile:first_name'),
    last_name: expectNullableString(row.last_name, 'mapProfile:last_name')
  }
}

function readServiceIssue(value: unknown): { slug: string } | null | undefined {
  if (value === undefined || value === null) return value
  const issue = expectRecord(value, 'mapServiceRequest:service_issue_types')
  return { slug: expectString(issue.slug, 'mapServiceRequest:service_issue_types.slug') }
}

function readServiceRequestRow(value: unknown): ServiceRequestRow {
  const row = expectRecord(value, 'mapServiceRequest:row')
  return {
    id: expectString(row.id, 'mapServiceRequest:id'),
    customer_id: expectString(row.customer_id, 'mapServiceRequest:customer_id'),
    status: expectKnownValue(row.status, requestTransitions, 'mapServiceRequest:status'),
    issue_slug: expectOptionalString(row.issue_slug, 'mapServiceRequest:issue_slug'),
    selected_price_option_id: expectNullableString(
      row.selected_price_option_id,
      'mapServiceRequest:selected_price_option_id'
    ),
    service_issue_types: readServiceIssue(row.service_issue_types)
  }
}

function readJobRow(value: unknown): JobRow {
  const row = expectRecord(value, 'mapJob:row')
  return {
    id: expectString(row.id, 'mapJob:id'),
    request_id: expectString(row.request_id, 'mapJob:request_id'),
    customer_id: expectString(row.customer_id, 'mapJob:customer_id'),
    professional_id: expectNullableString(row.professional_id, 'mapJob:professional_id'),
    status: expectKnownValue(row.status, jobTransitions, 'mapJob:status')
  }
}

function readPaymentRow(value: unknown): PaymentRow {
  const row = expectRecord(value, 'mapPayment:row')
  const amount = row.amount
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    throw new Error('mapPayment:amount must be a string or number')
  }

  return {
    id: expectString(row.id, 'mapPayment:id'),
    request_id: expectNullableString(row.request_id, 'mapPayment:request_id'),
    provider: expectKnownValue(row.provider, paymentProviders, 'mapPayment:provider'),
    provider_payment_id: expectNullableString(
      row.provider_payment_id,
      'mapPayment:provider_payment_id'
    ),
    status: expectKnownValue(row.status, paymentTransitions, 'mapPayment:status'),
    amount
  }
}

function readProfessionalRow(value: unknown): ProfessionalRow {
  const row = expectRecord(value, 'mapProfessional:row')
  if (row.internal_score !== null && typeof row.internal_score !== 'number') {
    throw new Error('mapProfessional:internal_score must be a number or null')
  }

  return {
    id: expectString(row.id, 'mapProfessional:id'),
    profile_id: expectString(row.profile_id, 'mapProfessional:profile_id'),
    status: expectKnownValue(row.status, professionalTransitions, 'mapProfessional:status'),
    internal_score: row.internal_score
  }
}

async function unwrap(promise: PromiseLike<QueryResult>, context: string): Promise<unknown> {
  const result = await promise
  if (result.error) throw new Error(`${context}:${result.error.message}`)
  if (!result.data) throw new Error(`${context}:not_found`)
  return result.data
}

export function mapProfile(value: unknown): ProfileRecord {
  const row = readProfileRow(value)
  return {
    id: row.id,
    authUserId: expectString(row.auth_user_id, 'mapProfile:auth_user_id'),
    role: row.role,
    email: row.email,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? ''
  }
}

export function mapServiceRequest(value: unknown): ServiceRequestRecord {
  const row = readServiceRequestRow(value)
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    issueSlug: row.issue_slug ?? row.service_issue_types?.slug ?? '',
    selectedPriceOptionId: row.selected_price_option_id ?? undefined
  }
}

export function mapJob(value: unknown): JobRecord {
  const row = readJobRow(value)
  return {
    id: row.id,
    requestId: row.request_id,
    customerId: row.customer_id,
    professionalId: row.professional_id ?? undefined,
    status: row.status
  }
}

export function mapPayment(value: unknown): PaymentRecord {
  const row = readPaymentRow(value)
  const amount = Number(row.amount)
  if (!Number.isFinite(amount)) throw new Error('mapPayment:amount must be numeric')

  return {
    id: row.id,
    requestId: expectString(row.request_id, 'mapPayment:request_id'),
    provider: row.provider,
    providerPaymentId: row.provider_payment_id ?? undefined,
    status: row.status,
    amount
  }
}

export function mapProfessional(value: unknown): ProfessionalRecord {
  const row = readProfessionalRow(value)
  return {
    id: row.id,
    profileId: row.profile_id,
    status: row.status,
    score: row.internal_score ?? 0
  }
}

export function createSupabaseLystoRepository(supabase: SupabaseLike): LystoRepository {
  return {
    async getProfile(profileId) {
      const result: QueryResult = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle()
      if (result.error) throw new Error(`getProfile:${result.error.message}`)
      return result.data ? mapProfile(result.data) : null
    },
    async saveServiceRequest(record) {
      // Temporary adapter: required database fields outside this repository contract remain unresolved.
      const row = await unwrap(
        supabase
          .from('service_requests')
          .upsert({
            id: record.id,
            customer_id: record.customerId,
            status: record.status,
            selected_price_option_id: record.selectedPriceOptionId ?? null
          }, { onConflict: 'id' })
          .select('*')
          .single(),
        'saveServiceRequest'
      )
      return { ...mapServiceRequest(row), issueSlug: record.issueSlug }
    },
    async getServiceRequest(requestId) {
      const result: QueryResult = await supabase
        .from('service_requests')
        .select('*, service_issue_types(slug)')
        .eq('id', requestId)
        .maybeSingle()
      if (result.error) throw new Error(`getServiceRequest:${result.error.message}`)
      return result.data ? mapServiceRequest(result.data) : null
    },
    async saveJob(record) {
      const row = await unwrap(
        supabase
          .from('jobs')
          .upsert({
            id: record.id,
            request_id: record.requestId,
            customer_id: record.customerId,
            professional_id: record.professionalId ?? null,
            status: record.status
          }, { onConflict: 'id' })
          .select('*')
          .single(),
        'saveJob'
      )
      return mapJob(row)
    },
    async getJob(jobId) {
      const result: QueryResult = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle()
      if (result.error) throw new Error(`getJob:${result.error.message}`)
      return result.data ? mapJob(result.data) : null
    },
    async savePayment(record) {
      const row = await unwrap(
        supabase
          .from('payments')
          .upsert({
            id: record.id,
            request_id: record.requestId,
            provider: record.provider,
            provider_payment_id: record.providerPaymentId ?? null,
            status: record.status,
            amount: record.amount
          }, { onConflict: 'id' })
          .select('*')
          .single(),
        'savePayment'
      )
      return mapPayment(row)
    },
    async getPayment(paymentId) {
      const result: QueryResult = await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle()
      if (result.error) throw new Error(`getPayment:${result.error.message}`)
      return result.data ? mapPayment(result.data) : null
    },
    async saveProfessional(record) {
      const row = await unwrap(
        supabase
          .from('professional_profiles')
          .upsert({
            id: record.id,
            profile_id: record.profileId,
            status: record.status,
            internal_score: record.score
          }, { onConflict: 'id' })
          .select('*')
          .single(),
        'saveProfessional'
      )
      return mapProfessional(row)
    },
    async getProfessional(professionalId) {
      const result: QueryResult = await supabase
        .from('professional_profiles')
        .select('*')
        .eq('id', professionalId)
        .maybeSingle()
      if (result.error) throw new Error(`getProfessional:${result.error.message}`)
      return result.data ? mapProfessional(result.data) : null
    }
  }
}
