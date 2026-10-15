import { notFound } from 'next/navigation'
import { JobQuotePanel } from '@/components/pricing/job-quote-panel'
import { requirePageSession } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

import { z } from 'zod'

export default async function CustomerRequestDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const session = await requirePageSession('customer')
  if (!session.customerId) notFound()
  const job = await session.client.from('jobs').select('id')
    .eq('request_id', id).eq('customer_id', session.customerId).maybeSingle()
    .then(result => {
      if (result.error) throw new ApiError('service_unavailable')
      return result.data
    }, () => { throw new ApiError('service_unavailable') })
  if (!job) notFound()
  return <JobQuotePanel requestId={id} />
}
