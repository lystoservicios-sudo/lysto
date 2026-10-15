import { MorePage } from '@/components/customer/more/more-ui'
import { CustomerEmailForm } from '@/components/customer/more/account-forms'
import { requirePageSession } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
export default async function Page() {
  const session = await requirePageSession('customer')
  const { data, error } = await session.client.auth.getUser()
  if (error || !data.user || data.user.id !== session.userId) throw new ApiError('session_unavailable')
  return <MorePage title="Cambiar correo" backHref="/app/perfil" backLabel="Volver a mis datos"><CustomerEmailForm email={data.user.email ?? ''} pendingEmail={data.user.new_email} customerId={session.customerId!} /></MorePage>
}
