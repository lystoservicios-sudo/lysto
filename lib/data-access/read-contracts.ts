import type { Database } from '@/lib/supabase/database.types'
export type ReadRole = 'customer' | 'professional' | 'admin'
export type ReadResource =
  | 'requests'
  | 'jobs'
  | 'payments'
  | 'equipment'
  | 'professionals'
  | 'claims'
type Enums = Database['public']['Enums']
type Dated = { id: string; createdAt: string }
export type RequestDto = Dated & {
  status: Enums['request_status']
  issueTypeId: string
  addressId: string | null
  equipmentId: string | null
  preferredDate: string | null
  preferredWindow: string | null
  urgency: Enums['urgency_level'] | null
}
export type JobDto = Dated & {
  requestId: string
  status: Enums['job_status']
  professionalId: string | null
  scheduledDate: string | null
  timeWindow: string | null
  completedAt: string | null
  finalAmount: number | null
  warrantyUntil?: string | null
}
type PaymentBase = Dated & {
  requestId: string | null
  jobId: string | null
  status: Enums['payment_status']
  currency: string
}
export type CustomerPaymentDto = PaymentBase & { amount: number }
export type ProfessionalPaymentDto = PaymentBase & { amountToReceive: number }
export type AdminPaymentDto = CustomerPaymentDto & {
  marketplaceFee: number
  professionalAmount: number
  provider: string
}
export type EquipmentDto = Dated & {
  nickname: string
  type: string | null
  brand: string | null
  model: string | null
}
export type ProfessionalDto = Dated & {
  status: Enums['professional_status']
  ratingAvg: number | null
  jobsCompleted: number
  yearsExperience: number
}
export type AdminProfessionalDto = ProfessionalDto & { internalScore: number }
export type ClaimDto = Dated & {
  jobId: string
  status: string
  description: string
  resolution: string | null
}
export type ReadDtoMap<R extends ReadRole> = {
  requests: RequestDto
  jobs: JobDto
  payments: R extends 'customer'
    ? CustomerPaymentDto
    : R extends 'professional'
      ? ProfessionalPaymentDto
      : AdminPaymentDto
  equipment: EquipmentDto
  professionals: R extends 'admin' ? AdminProfessionalDto : ProfessionalDto
  claims: ClaimDto
}
export type ReadPage<T> = { items: T[]; total: number; nextCursor: string | null }
export type ReadOptions = { pageSize?: number; cursor?: string; status?: string }
export type ReadMetrics = Partial<Record<ReadResource, number>> & { activeJobs: number }
export type ReadRepository<R extends ReadRole> = {
  list<K extends ReadResource>(
    resource: K,
    options?: ReadOptions
  ): Promise<ReadPage<ReadDtoMap<R>[K]>>
  detail<K extends ReadResource>(resource: K, id: string): Promise<ReadDtoMap<R>[K] | null>
  metrics(): Promise<ReadMetrics>
}
export type ReadState<T> =
  | { state: 'loading' }
  | { state: 'error'; message: string; retryable: boolean }
  | { state: 'empty' }
  | { state: 'ready'; data: T }
