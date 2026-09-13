'use client'

import { PaymentPanel } from '@/components/payments/payment-panel'
import { ServiceOffers } from '@/components/pricing/service-offers'
import type { ProfessionalLiveJob } from '@/lib/professional/live-model'
import { LiveProfessionalDashboard, LiveProfessionalJobs } from './live-professional'
import { ProPage } from './pro-ui'

/** Compatibility exports for isolated previews; production pages pass authenticated data. */
export function ProfessionalDashboard({ jobs = [] }: { jobs?: ProfessionalLiveJob[] }) {
  return <LiveProfessionalDashboard name="Profesional" rating={null} jobs={jobs} />
}
export function ProfessionalRequests() {
  return (
    <ProPage title="Propuestas disponibles" description="Propuestas asignadas a tu perfil.">
      <ServiceOffers />
    </ProPage>
  )
}
export function ProfessionalJobs({ jobs = [] }: { jobs?: ProfessionalLiveJob[] }) {
  return <LiveProfessionalJobs jobs={jobs} />
}
export function ProfessionalAgenda({ jobs = [] }: { jobs?: ProfessionalLiveJob[] }) {
  return <LiveProfessionalJobs jobs={jobs} />
}
export function ProfessionalPayments() {
  return <PaymentPanel role="professional" />
}
