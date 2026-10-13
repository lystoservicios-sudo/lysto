import type { CustomerHomeViewModel } from '@/features/customer/home-view-model'
import { CustomerHome } from './customer-home'

export function CustomerDashboard({ model }: { model: CustomerHomeViewModel }) {
  return <CustomerHome model={model} />
}
