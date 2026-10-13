import { CustomerHogar } from '@/components/customer/hogar/customer-hogar'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerHomes } from '@/lib/customer-homes/service'
import { ApiError } from '@/lib/http/api-error'

export default async function CustomerHogarPage() {
  const session = await requirePageSession('customer')
  if (!session.customerId) throw new ApiError('forbidden')
  const initialData = await readCustomerHomes(session)
  return <CustomerHogar initialData={initialData} customerId={session.customerId} />
}
