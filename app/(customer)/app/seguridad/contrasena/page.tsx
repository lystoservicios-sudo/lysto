import { MorePage } from '@/components/customer/more/more-ui'
import { CustomerPasswordForm } from '@/components/customer/more/account-forms'
import { requirePageSession } from '@/lib/auth/session'
export default async function Page() {
  const session = await requirePageSession('customer')
  return <MorePage title="Cambiar contraseña" backHref="/app/seguridad" backLabel="Volver a Seguridad"><CustomerPasswordForm customerId={session.customerId!} /></MorePage>
}
