import { PageScaffold } from '@/components/layout/page-scaffold'
import { ConnectedCustomerAddresses } from '@/components/customer/connected-customer-addresses'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerAddresses } from '@/lib/customer-assets/service'

export default async function CustomerAddressesPage() {
  const page = await listCustomerAddresses(await requirePageSession('customer'))
  return (
    <PageScaffold
      title="Direcciones y accesos"
      eyebrow="Cliente"
      description="Prepará cada visita con una ubicación clara y las condiciones de acceso."
    >
      <ConnectedCustomerAddresses initialPage={page} />
    </PageScaffold>
  )
}
