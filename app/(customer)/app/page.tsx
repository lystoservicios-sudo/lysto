import { CustomerDashboard } from '@/components/customer/customer-dashboard'
import { requirePageSession } from '@/lib/auth/session'
import { customerLiveData } from '@/lib/customer/live-model'

export default async function CustomerDashboardPage() {
  const data = await customerLiveData(await requirePageSession('customer'))
  return <CustomerDashboard model={data.dashboard} />
}
