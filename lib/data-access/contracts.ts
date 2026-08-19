import type { JobStatus, PaymentStatus, ProfessionalStatus, RequestStatus, UserRole } from '../domain/types.ts'

export type ProfileRecord = {
  id: string
  authUserId: string
  role: UserRole
  email: string
  firstName: string
  lastName: string
}

export type ServiceRequestRecord = {
  id: string
  customerId: string
  status: RequestStatus
  issueSlug: string
  selectedPriceOptionId?: string
}

export type JobRecord = {
  id: string
  requestId: string
  customerId: string
  professionalId?: string
  status: JobStatus
}

export type ProfessionalRecord = {
  id: string
  profileId: string
  status: ProfessionalStatus
  score: number
}

export type PaymentRecord = {
  id: string
  requestId: string
  provider: 'mercadopago'
  providerPaymentId?: string
  status: PaymentStatus
  amount: number
}

export type LystoRepository = {
  getProfile(profileId: string): Promise<ProfileRecord | null>
  saveServiceRequest(record: ServiceRequestRecord): Promise<ServiceRequestRecord>
  getServiceRequest(requestId: string): Promise<ServiceRequestRecord | null>
  saveJob(record: JobRecord): Promise<JobRecord>
  getJob(jobId: string): Promise<JobRecord | null>
  savePayment(record: PaymentRecord): Promise<PaymentRecord>
  getPayment(paymentId: string): Promise<PaymentRecord | null>
  saveProfessional(record: ProfessionalRecord): Promise<ProfessionalRecord>
  getProfessional(professionalId: string): Promise<ProfessionalRecord | null>
}
