import { MorePage } from '@/components/customer/more/more-ui'
import { ConnectedCustomerAddresses } from '@/components/customer/connected-customer-addresses'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerAddresses } from '@/lib/customer-assets/service'

export default async function CustomerAddressesPage() {
  const page = await listCustomerAddresses(await requirePageSession('customer'))
  return (
    <MorePage
      title="Direcciones y accesos"
      description="Prepará cada visita con una ubicación clara y las condiciones de acceso."
      backHref="/app/hogar"
      backLabel="Volver a Hogar"
    >
      <ConnectedCustomerAddresses initialPage={page} />
    </MorePage>
  )
}
