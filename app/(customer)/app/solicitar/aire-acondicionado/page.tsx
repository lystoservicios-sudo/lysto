import { PageScaffold } from '@/components/layout/page-scaffold'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'

export default function RequestAirConditioningPage() {
  return (
    <PageScaffold
      title="Solicitar servicio"
      eyebrow="Cliente · Demostración"
      description="Contanos qué necesitás y revisá tu presupuesto. Solo se guarda cuando lo indicás. Sin cobros en esta etapa."
    >
      <AirConditioningWizard />
    </PageScaffold>
  )
}
