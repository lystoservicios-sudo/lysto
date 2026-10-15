import { MorePage } from '@/components/customer/more/more-ui'
import { CustomerPreferencesForm } from '@/components/customer/more/account-forms'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerPreferences } from '@/lib/customer-account/service'
export default async function Page() {
  const session = await requirePageSession('customer')
  const { preferences } = await readCustomerPreferences(session)
  return <MorePage title="Notificaciones y preferencias" description="Elegí qué novedades recibir y cómo se mueve la app."><CustomerPreferencesForm initialValue={preferences} customerId={session.customerId!} /></MorePage>
}
