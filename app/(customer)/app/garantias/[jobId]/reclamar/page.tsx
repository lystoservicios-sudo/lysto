import { notFound } from 'next/navigation'
import { MorePage } from '@/components/customer/more/more-ui'
import { WarrantyClaimForm } from '@/components/customer/more-support/case-form'
import { requirePageSession } from '@/lib/auth/session'
import { loadWarrantyServices } from '@/lib/support/customer-center'

export default async function WarrantyClaimPage({ params }: { params: Promise<{ jobId: string }> }) {
  const session = await requirePageSession('customer'), { jobId } = await params, job = (await loadWarrantyServices(session, { id: jobId })).items[0]
  if (!job) notFound()
  return <MorePage title="Informar un problema" description={`${job.equipment} · ${job.label}`} backHref={`/app/garantias/${job.id}`} backLabel="Volver al servicio"><WarrantyClaimForm key={`${session.customerId}:${job.id}`} job={job} customerId={session.customerId!} /></MorePage>
}
