import { ConnectedCustomerEquipment } from '@/components/customer/connected-customer-equipment'
import { MoreLink, MorePage } from '@/components/customer/more/more-ui'
import { Archive } from 'lucide-react'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerAddresses, listCustomerEquipment } from '@/lib/customer-assets/service'

export default async function CustomerEquipmentPage() {
  const session = await requirePageSession('customer')
  const [equipment, addresses] = await Promise.all([
    listCustomerEquipment(session),
    listCustomerAddresses(session)
  ])
  return (
    <MorePage
      title="Mis equipos"
      description="Registrá tus equipos y conservá sus datos y fotos."
      backHref="/app/hogar"
      backLabel="Volver a Hogar"
    >
      <ConnectedCustomerEquipment initialPage={equipment} initialAddresses={addresses} />
      <MoreLink href="/app/equipos/archivo" title="Ver equipos archivados" description="Los equipos que ya no usás conservan su historial." icon={Archive} />
    </MorePage>
  )
}
