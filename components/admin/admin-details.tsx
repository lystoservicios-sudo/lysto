'use client'

import { ServiceOffers } from '@/components/pricing/service-offers'
import { Header, Panel } from './admin-ui'

export function MatchingPage() {
  return <ServiceOffers />
}
export function CandidateSelector({ request }: { request?: unknown }) {
  return (
    <div data-has-request={request ? 'true' : undefined}>
      <ServiceOffers />
    </div>
  )
}
export function RequestDetailPage({ request }: { request: { id: string } }) {
  return (
    <>
      <Header
        title={`Solicitud ${request.id}`}
        description="El detalle productivo usa el contrato canónico."
      />
      <Panel title="Detalle">
        <p>Abrí la ruta autenticada para consultar el registro.</p>
      </Panel>
    </>
  )
}
export function JobDetailPage({ job }: { job: { id: string } }) {
  return (
    <>
      <Header
        title={`Trabajo ${job.id}`}
        description="El detalle productivo usa el contrato canónico."
      />
      <Panel title="Detalle">
        <p>Abrí la ruta autenticada para consultar el registro.</p>
      </Panel>
    </>
  )
}
export function CustomerDetailPage({ customer }: { customer: { id: string } }) {
  return (
    <>
      <Header
        title={`Cliente ${customer.id}`}
        description="El detalle productivo se obtiene con permiso de operaciones."
      />
      <Panel title="Detalle">
        <p>Abrí la ruta autenticada para consultar el registro.</p>
      </Panel>
    </>
  )
}
