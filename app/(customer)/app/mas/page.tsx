import { CustomerMore } from '@/components/customer/more/customer-more'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerMore } from '@/lib/customer-more/hub'

export default async function CustomerMorePage() {
  return <CustomerMore {...await readCustomerMore(await requirePageSession('customer'))} />
}
