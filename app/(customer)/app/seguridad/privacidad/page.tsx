import { MorePage } from '@/components/customer/more/more-ui'
import { CustomerPrivacyForm } from '@/components/customer/more/account-forms'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerPrivacy } from '@/lib/customer-account/service'
export default async function Page() {
  const session = await requirePageSession('customer')
  return <MorePage title="Privacidad y gestión de cuenta" backHref="/app/seguridad" backLabel="Volver a Seguridad"><CustomerPrivacyForm initialValue={await readCustomerPrivacy(session)} customerId={session.customerId!} /></MorePage>
}
