import { PageScaffold } from '@/components/layout/page-scaffold'
import { AddressSummaryCard } from '@/components/customer/address-summary-card'
import { CustomerAddressForm } from '@/components/customer/customer-address-form'
import { InfoNotice } from '@/components/customer/info-notice'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

export default function CustomerAddressesPage() {
  const address = customerDemoFixtures.addresses[0]

  return (
    <PageScaffold title="Direcciones y accesos" eyebrow="Cliente · Demostración" description="Prepará cada visita con una ubicación clara y condiciones de acceso estructuradas.">
      <InfoNotice title="Una dirección completa evita demoras" description="Ascensor, estacionamiento, escaleras y altura ayudan a elegir herramientas y organizar la llegada." />
      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <section aria-labelledby="saved-addresses-title" className="space-y-3">
          <h2 id="saved-addresses-title" className="text-xl font-black text-slate-950">Direcciones registradas</h2>
          <AddressSummaryCard address={address} />
        </section>
        <CustomerAddressForm initialValue={address} />
      </div>
    </PageScaffold>
  )
}
