import { CustomerJobList } from '@/components/customer/customer-job-list'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { ButtonLink } from '@/components/ui/button'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerJobsLive } from '@/lib/customer/live-model'

export default async function CustomerJobsPage({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const { cursor } = await searchParams
  const jobs = await listCustomerJobsLive(await requirePageSession('customer'), {
    pageSize: 25,
    ...(cursor ? { cursor } : {})
  })
  return (
    <PageScaffold
      title="Mis trabajos"
      eyebrow="Cliente"
      description="Seguí cada visita, revisá decisiones pendientes y consultá los servicios finalizados."
    >
      <CustomerJobList jobs={jobs.items} />
      {jobs.nextCursor ? (
        <ButtonLink
          href={`/app/trabajos?cursor=${encodeURIComponent(jobs.nextCursor)}`}
          variant="secondary"
        >
          Ver trabajos anteriores
        </ButtonLink>
      ) : null}
    </PageScaffold>
  )
}
