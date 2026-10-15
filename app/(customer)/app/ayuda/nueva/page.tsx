import { z } from 'zod'
import { notFound } from 'next/navigation'
import { MorePage } from '@/components/customer/more/more-ui'
import { SupportCaseForm } from '@/components/customer/more-support/case-form'
import { requirePageSession } from '@/lib/auth/session'
import { loadSupportJobs } from '@/lib/support/customer-center'
import { supportCategories } from '@/lib/support/customer-content'

export default async function NewCustomerCasePage({ searchParams }: { searchParams: Promise<{ jobId?: string; categoria?: string; category?: string }> }) {
  const session = await requirePageSession('customer'), input = await searchParams
  const jobs = await loadSupportJobs(session, false, input.jobId)
  if (input.jobId && (!z.string().uuid().safeParse(input.jobId).success || !jobs.some(j => j.id === input.jobId))) notFound()
  const category = supportCategories.find(c => c.value === (input.categoria ?? input.category))?.value ?? 'other'
  return <MorePage title="Nueva consulta" description="Tu consulta quedará guardada con su seguimiento." backHref="/app/ayuda" backLabel="Volver a Ayuda"><SupportCaseForm key={session.customerId} jobs={jobs} initialJobId={input.jobId} initialCategory={category} customerId={session.customerId!} /></MorePage>
}
