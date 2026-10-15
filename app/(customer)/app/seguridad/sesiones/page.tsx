import { MorePage } from '@/components/customer/more/more-ui'
import { CustomerSessionList } from '@/components/customer/more/account-forms'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerAccountSessions } from '@/lib/customer-account/service'
export default async function Page() {
  const session = await requirePageSession('customer')
  const { sessions } = await listCustomerAccountSessions(session)
  return <MorePage title="Sesiones y dispositivos" backHref="/app/seguridad" backLabel="Volver a Seguridad"><CustomerSessionList sessions={sessions} customerId={session.customerId!} /></MorePage>
}
