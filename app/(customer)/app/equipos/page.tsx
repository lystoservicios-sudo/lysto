import { ConnectedCustomerEquipment } from '@/components/customer/connected-customer-equipment'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerAddresses, listCustomerEquipment } from '@/lib/customer-assets/service'
import { ButtonLink } from '@/components/ui/button'

export default async function CustomerEquipmentPage() {
  const session = await requirePageSession('customer')
  const [equipment, addresses] = await Promise.all([
    listCustomerEquipment(session),
    listCustomerAddresses(session)
  ])
  return (
    <PageScaffold
      title="Mis equipos"
      eyebrow="Cliente"
      description="Registrá tus equipos y conservá sus datos y fotos."
    >
      <ButtonLink href="/app/equipos/archivo" variant="secondary">
        Ver equipos archivados
      </ButtonLink>
      <ConnectedCustomerEquipment initialPage={equipment} initialAddresses={addresses} />
    </PageScaffold>
  )
}
