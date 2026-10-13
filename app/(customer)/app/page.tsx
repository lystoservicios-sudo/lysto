import { CustomerDashboard } from '@/components/customer/customer-dashboard'
import { requirePageSession } from '@/lib/auth/session'
import { loadCustomerHome } from '@/lib/customer/home-model'

export default async function CustomerDashboardPage() {
  const model = await loadCustomerHome(await requirePageSession('customer'))
  return <CustomerDashboard model={model} />
}
