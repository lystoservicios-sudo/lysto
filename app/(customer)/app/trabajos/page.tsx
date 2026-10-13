import { z } from 'zod'
import { CustomerServices } from '@/components/customer/customer-services'
import { requirePageSession } from '@/lib/auth/session'
import { loadCustomerServices } from '@/lib/customer/services-model'

export default async function CustomerJobsPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string; serviceCursor?: string; quoteCursor?: string }>
}) {
  const parameters = await searchParams
  const parsed = z.enum(['all', 'in_progress', 'scheduled', 'finished']).safeParse(parameters.filter)
  const filter = parsed.success ? parsed.data : 'all'
  const page = await loadCustomerServices(await requirePageSession('customer'), {
    filter,
    pageSize: 25,
    ...(typeof parameters.serviceCursor === 'string' ? { serviceCursor: parameters.serviceCursor } : {}),
    ...(typeof parameters.quoteCursor === 'string' ? { quoteCursor: parameters.quoteCursor } : {})
  })
  return <CustomerServices initialPage={page} initialFilter={filter} />
}
