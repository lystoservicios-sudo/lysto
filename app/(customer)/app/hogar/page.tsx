import { CustomerHogar } from '@/components/customer/hogar/customer-hogar'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerHomes } from '@/lib/customer-homes/service'
import { ApiError } from '@/lib/http/api-error'

export default async function CustomerHogarPage({ searchParams }: { searchParams?: Promise<{ crear?: string | string[] }> }) {
  const session = await requirePageSession('customer')
  if (!session.customerId) throw new ApiError('forbidden')
  const initialData = await readCustomerHomes(session)
  const params = await searchParams
  const entry = params?.crear === 'hogar' || params?.crear === 'equipo' ? params.crear : undefined
  return <CustomerHogar initialData={initialData} customerId={session.customerId} entry={entry} />
}
