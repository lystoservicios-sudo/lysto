import type { SupabaseClient } from '@supabase/supabase-js'
import { jobTransitions, paymentTransitions, professionalTransitions, requestTransitions } from '../../domain/state-machine.ts'
import type { Database } from '../../supabase/database.types.ts'
import type { JobRecord, LystoReadRepository, PaymentRecord, ProfessionalRecord, ProfileRecord, ServiceRequestRecord } from '../contracts.ts'

type PublicTables = Database['public']['Tables']
type SupabaseLike = Pick<SupabaseClient<Database>, 'from'>

type ProfileRow = Pick<
  PublicTables['profiles']['Row'],
  'id' | 'auth_user_id' | 'role' | 'email' | 'first_name' | 'last_name'
>

type ServiceIssueRow = Pick<PublicTables['service_issue_types']['Row'], 'slug'>
type ServiceRequestRow = Pick<
  PublicTables['service_requests']['Row'],
  'id' | 'customer_id' | 'status' | 'selected_price_option_id'
> & { service_issue_types: ServiceIssueRow }

type JobRow = Pick<
  PublicTables['jobs']['Row'],
  'id' | 'request_id' | 'customer_id' | 'professional_id' | 'status'
>

type PaymentRow = Pick<
  PublicTables['payments']['Row'],
  'id' | 'request_id' | 'status'
> & {
  provider: PaymentRecord['provider']
  provider_payment_id?: string | null
  amount: string | number
}

type ProfessionalRow = Pick<
  PublicTables['professional_profiles']['Row'],
  'id' | 'profile_id' | 'status' | 'internal_score'
>

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
    first_name: expectString(row.first_name, 'mapProfile:first_name'),
    last_name: expectString(row.last_name, 'mapProfile:last_name')
  }
}

function readServiceIssue(value: unknown): ServiceIssueRow {
  const issue = expectRecord(value, 'mapServiceRequest:service_issue_types')
  return { slug: expectString(issue.slug, 'mapServiceRequest:service_issue_types.slug') }
}

function readServiceRequestRow(value: unknown): ServiceRequestRow {
  const row = expectRecord(value, 'mapServiceRequest:row')
  return {
    id: expectString(row.id, 'mapServiceRequest:id'),
    customer_id: expectString(row.customer_id, 'mapServiceRequest:customer_id'),
    status: expectKnownValue(row.status, requestTransitions, 'mapServiceRequest:status'),
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
    provider_payment_id: row.provider_payment_id === undefined
      ? null
      : expectNullableString(row.provider_payment_id, 'mapPayment:provider_payment_id'),
    status: expectKnownValue(row.status, paymentTransitions, 'mapPayment:status'),
    amount
  }
}

function readProfessionalRow(value: unknown): ProfessionalRow {
  const row = expectRecord(value, 'mapProfessional:row')
  if (typeof row.internal_score !== 'number') {
    throw new Error('mapProfessional:internal_score must be a number')
  }

  return {
    id: expectString(row.id, 'mapProfessional:id'),
    profile_id: expectString(row.profile_id, 'mapProfessional:profile_id'),
    status: expectKnownValue(row.status, professionalTransitions, 'mapProfessional:status'),
    internal_score: row.internal_score
  }
}

export function mapProfile(value: unknown): ProfileRecord {
  const row = readProfileRow(value)
  return {
    id: row.id,
    authUserId: expectString(row.auth_user_id, 'mapProfile:auth_user_id'),
    role: row.role,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name
  }
}

export function mapServiceRequest(value: unknown): ServiceRequestRecord {
  const row = readServiceRequestRow(value)
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    issueSlug: row.service_issue_types.slug,
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
    score: row.internal_score
  }
}

export function createSupabaseLystoRepository(supabase: SupabaseLike): LystoReadRepository {
  return {
    async getProfile(profileId) {
      const result = await supabase
        .from('profiles')
        .select('id,auth_user_id,role,email,first_name,last_name')
        .eq('id', profileId)
        .maybeSingle()
      if (result.error) throw new Error(`getProfile:${result.error.message}`)
      return result.data ? mapProfile(result.data) : null
    },
    async getServiceRequest(requestId) {
      const result = await supabase
        .from('service_requests')
        .select(`
          id,
          customer_id,
          status,
          selected_price_option_id,
          service_issue_types!service_requests_issue_type_id_fkey(slug)
        `)
        .eq('id', requestId)
        .maybeSingle()
      if (result.error) throw new Error(`getServiceRequest:${result.error.message}`)
      return result.data ? mapServiceRequest(result.data) : null
    },
    async getJob(jobId) {
      const result = await supabase
        .from('jobs')
        .select('id,request_id,customer_id,professional_id,status')
        .eq('id', jobId)
        .maybeSingle()
      if (result.error) throw new Error(`getJob:${result.error.message}`)
      return result.data ? mapJob(result.data) : null
    },
    async getPayment(paymentId) {
      const result = await supabase
        .from('payments')
        .select('id,request_id,provider,status,amount')
        .eq('id', paymentId)
        .maybeSingle()
      if (result.error) throw new Error(`getPayment:${result.error.message}`)
      return result.data ? mapPayment(result.data) : null
    },
    async getProfessional(professionalId) {
      const result = await supabase
        .from('professional_profiles')
        .select('id,profile_id,status,internal_score')
        .eq('id', professionalId)
        .maybeSingle()
      if (result.error) throw new Error(`getProfessional:${result.error.message}`)
      return result.data ? mapProfessional(result.data) : null
    }
  }
}
