import { CustomerDashboard } from '@/components/customer/customer-dashboard'
import { buildCustomerDashboardViewModel } from '@/features/customer/dashboard-view-model'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

export default function CustomerDashboardPage() {
  const model = buildCustomerDashboardViewModel({
    customerName: customerDemoFixtures.profile.firstName,
    jobs: customerDemoFixtures.jobs,
    equipment: customerDemoFixtures.equipment,
    maintenance: customerDemoFixtures.maintenance,
    warranties: customerDemoFixtures.warranties
  })

  return <CustomerDashboard model={model} />
}
