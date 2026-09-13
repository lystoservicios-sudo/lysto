import { notFound } from 'next/navigation'
import { JobQuotePanel } from '@/components/pricing/job-quote-panel'
import { ProfessionalJobDetail } from '@/components/pro/pro-details'
import { professionalJobs } from '@/components/pro/pro-model'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return <JobQuotePanel jobId={id} />
  const job = professionalJobs.find(record => record.id === id)
  if (!job) notFound()
  return <ProfessionalJobDetail key={job.id} job={job} />
}
