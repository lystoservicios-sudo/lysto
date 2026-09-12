import { notFound } from 'next/navigation'
import { JobQuotePanel } from '@/components/pricing/job-quote-panel'
import { z } from 'zod'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  return <JobQuotePanel requestId={id} />
}
