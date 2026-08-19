import { PageScaffold } from '@/components/layout/page-scaffold'
import { PricingConfigFormMock } from '@/components/business/forms'

export default function AdminPricingPage() {
  return <PageScaffold title="Precios" eyebrow="Admin" description="Matriz de precio base, ajustes, prioridad, zonas y comisión."><PricingConfigFormMock /></PageScaffold>
}
