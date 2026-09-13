import { ServiceOffers } from '@/components/pricing/service-offers'
import { ProPage } from '@/components/pro/pro-ui'

export default function Page() {
  return (
    <ProPage
      title="Propuestas disponibles"
      description="Revisá y respondé únicamente las propuestas asignadas a tu perfil."
    >
      <ServiceOffers />
    </ProPage>
  )
}
