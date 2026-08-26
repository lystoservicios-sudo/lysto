import { PageScaffold } from '@/components/layout/page-scaffold'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'

export default function RequestAirConditioningPage() {
  return (
    <PageScaffold
      title="Solicitar servicio"
      eyebrow="Cliente · Demostración"
      description="Prepará el parte técnico, elegí una franja y revisá el presupuesto preliminar. Nada se enviará ni cobrará en esta etapa."
    >
      <AirConditioningWizard />
    </PageScaffold>
  )
}
