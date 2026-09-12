import { PageScaffold } from '@/components/layout/page-scaffold'
import { ConnectedCustomerProfile } from '@/components/customer/connected-customer-profile'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerProfile } from '@/lib/customer-assets/service'
import { CustomerEmailChange } from '@/components/customer/customer-email-change'

export default async function CustomerProfilePage() {
  const profile = await readCustomerProfile(await requirePageSession('customer'))
  return (
    <PageScaffold
      title="Tu perfil"
      eyebrow="Cliente"
      description="Revisá tus datos de contacto y cómo querés recibir novedades sobre una visita."
    >
      <ConnectedCustomerProfile initialValue={profile} />
      <CustomerEmailChange />
    </PageScaffold>
  )
}
