import type { JobRecord, LystoRepository, PaymentRecord, ProfessionalRecord, ProfileRecord, ServiceRequestRecord } from './contracts.ts'

export function createInMemoryLystoRepository(seed?: Partial<{
  profiles: ProfileRecord[]
  serviceRequests: ServiceRequestRecord[]
  jobs: JobRecord[]
  payments: PaymentRecord[]
  professionals: ProfessionalRecord[]
}>): LystoRepository & { snapshot(): Record<string, unknown[]> } {
  const profiles = new Map((seed?.profiles ?? []).map((record) => [record.id, record]))
  const serviceRequests = new Map((seed?.serviceRequests ?? []).map((record) => [record.id, record]))
  const jobs = new Map((seed?.jobs ?? []).map((record) => [record.id, record]))
  const payments = new Map((seed?.payments ?? []).map((record) => [record.id, record]))
  const professionals = new Map((seed?.professionals ?? []).map((record) => [record.id, record]))

  return {
    async getProfile(profileId) { return profiles.get(profileId) ?? null },
    async saveServiceRequest(record) { serviceRequests.set(record.id, record); return record },
    async getServiceRequest(requestId) { return serviceRequests.get(requestId) ?? null },
    async saveJob(record) { jobs.set(record.id, record); return record },
    async getJob(jobId) { return jobs.get(jobId) ?? null },
    async savePayment(record) { payments.set(record.id, record); return record },
    async getPayment(paymentId) { return payments.get(paymentId) ?? null },
    async saveProfessional(record) { professionals.set(record.id, record); return record },
    async getProfessional(professionalId) { return professionals.get(professionalId) ?? null },
    snapshot() { return { profiles: [...profiles.values()], serviceRequests: [...serviceRequests.values()], jobs: [...jobs.values()], payments: [...payments.values()], professionals: [...professionals.values()] } }
  }
}
