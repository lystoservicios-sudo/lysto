import { PageScaffold } from '@/components/layout/page-scaffold'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'

export default function RequestAirConditioningPage() {
  return <PageScaffold title="Solicitar técnico de aire" eyebrow="Wizard cliente" description="Flujo completo de problema, diagnóstico, dirección, horario, presupuesto y búsqueda del profesional."><AirConditioningWizard /></PageScaffold>
}
