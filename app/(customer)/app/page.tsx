import { redirect } from 'next/navigation'
import { readCustomerSession } from '@/lib/auth/customer-session'
import { CustomerAccountEntry } from '@/components/customer/account-details'

export default async function CustomerDashboardPage() {
  const session = await readCustomerSession()
  if (session.kind !== 'customer') redirect('/login')
  return <CustomerAccountEntry firstName={session.profile.first_name} address={session.address}/>
}
