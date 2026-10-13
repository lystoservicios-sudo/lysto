import { CustomerHogar } from '@/components/customer/hogar/customer-hogar'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerHomes } from '@/lib/customer-homes/service'

export default async function CustomerHogarPage() {
  const session = await requirePageSession('customer')
  const initialData = await readCustomerHomes(session)
  return <CustomerHogar initialData={initialData} />
}
