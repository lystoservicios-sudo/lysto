import { notFound } from 'next/navigation'
import { MorePage } from '@/components/customer/more/more-ui'
import { CustomerCaseDetail } from '@/components/customer/more-support/case-detail'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerCase } from '@/lib/support/customer-center'
import { ApiError } from '@/lib/http/api-error'

export default async function CustomerCasePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageSession('customer'), { id } = await params, item = await readCustomerCase(session, id)
  if (!item) notFound()
  const job = item.jobId ? await session.client.from('jobs').select('request_id').eq('id', item.jobId).eq('customer_id', session.customerId!).maybeSingle() : { data: null, error: null }
  if (job.error) throw new ApiError('service_unavailable')
  return <MorePage title="Detalle de la consulta" description="Respuestas, documentación y próximos pasos." backHref="/app/ayuda/consultas" backLabel="Volver a Mis consultas"><CustomerCaseDetail key={`${session.customerId}:${item.id}`} initialCase={item} customerId={session.customerId!} requestId={job.data?.request_id} /></MorePage>
}
