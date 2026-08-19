import type { JobRecord, LystoRepository, PaymentRecord, ProfessionalRecord, ProfileRecord, ServiceRequestRecord } from '../contracts.ts'

type QueryResult<T> = { data: T | null; error: { message: string } | null }
type SupabaseLike = {
  from(table: string): {
    select(columns?: string): any
    upsert(value: unknown, options?: unknown): any
    insert(value: unknown, options?: unknown): any
    update(value: unknown): any
  }
}

async function unwrap<T>(promise: Promise<QueryResult<T>> | QueryResult<T>, context: string): Promise<T> {
  const result = await promise
  if (result.error) throw new Error(`${context}:${result.error.message}`)
  if (!result.data) throw new Error(`${context}:not_found`)
  return result.data
}

function mapProfile(row: any): ProfileRecord {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    role: row.role,
    email: row.email,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? ''
  }
}

function mapServiceRequest(row: any): ServiceRequestRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    issueSlug: row.issue_slug ?? row.service_issue_types?.slug ?? '',
    selectedPriceOptionId: row.selected_price_option_id ?? undefined
  }
}

function mapJob(row: any): JobRecord {
  return { id: row.id, requestId: row.request_id, customerId: row.customer_id, professionalId: row.professional_id ?? undefined, status: row.status }
}

function mapPayment(row: any): PaymentRecord {
  return {
    id: row.id,
    requestId: row.request_id,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id ?? undefined,
    status: row.status,
    amount: Number(row.amount)
  }
}

function mapProfessional(row: any): ProfessionalRecord {
  return { id: row.id, profileId: row.profile_id, status: row.status, score: row.internal_score ?? 0 }
}

export function createSupabaseLystoRepository(supabase: SupabaseLike): LystoRepository {
  return {
    async getProfile(profileId) {
      const result = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle()
      if (result.error) throw new Error(`getProfile:${result.error.message}`)
      return result.data ? mapProfile(result.data) : null
    },
    async saveServiceRequest(record) {
      const row = await unwrap<any>(supabase.from('service_requests').upsert({ id: record.id, customer_id: record.customerId, status: record.status, selected_price_option_id: record.selectedPriceOptionId ?? null }, { onConflict: 'id' }).select('*').single(), 'saveServiceRequest')
      return mapServiceRequest({ ...row, issue_slug: record.issueSlug })
    },
    async getServiceRequest(requestId) {
      const result = await supabase.from('service_requests').select('*, service_issue_types(slug)').eq('id', requestId).maybeSingle()
      if (result.error) throw new Error(`getServiceRequest:${result.error.message}`)
      return result.data ? mapServiceRequest(result.data) : null
    },
    async saveJob(record) {
      const row = await unwrap<any>(supabase.from('jobs').upsert({ id: record.id, request_id: record.requestId, customer_id: record.customerId, professional_id: record.professionalId ?? null, status: record.status }, { onConflict: 'id' }).select('*').single(), 'saveJob')
      return mapJob(row)
    },
    async getJob(jobId) {
      const result = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle()
      if (result.error) throw new Error(`getJob:${result.error.message}`)
      return result.data ? mapJob(result.data) : null
    },
    async savePayment(record) {
      const row = await unwrap<any>(supabase.from('payments').upsert({ id: record.id, request_id: record.requestId, provider: record.provider, provider_payment_id: record.providerPaymentId ?? null, status: record.status, amount: record.amount }, { onConflict: 'id' }).select('*').single(), 'savePayment')
      return mapPayment(row)
    },
    async getPayment(paymentId) {
      const result = await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle()
      if (result.error) throw new Error(`getPayment:${result.error.message}`)
      return result.data ? mapPayment(result.data) : null
    },
    async saveProfessional(record) {
      const row = await unwrap<any>(supabase.from('professional_profiles').upsert({ id: record.id, profile_id: record.profileId, status: record.status, internal_score: record.score }, { onConflict: 'id' }).select('*').single(), 'saveProfessional')
      return mapProfessional(row)
    },
    async getProfessional(professionalId) {
      const result = await supabase.from('professional_profiles').select('*').eq('id', professionalId).maybeSingle()
      if (result.error) throw new Error(`getProfessional:${result.error.message}`)
      return result.data ? mapProfessional(result.data) : null
    }
  }
}
