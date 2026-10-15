import { MorePage } from '@/components/customer/more/more-ui'
import { CustomerProfileEditor } from '@/components/customer/more/account-forms'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerProfile } from '@/lib/customer-assets/service'

export default async function CustomerProfilePage() {
  const session = await requirePageSession('customer')
  const profile = await readCustomerProfile(session)
  return <MorePage title="Datos personales" description="Tus datos de contacto para coordinar visitas y consultas."><CustomerProfileEditor profile={profile} customerId={session.customerId!} /></MorePage>
}
