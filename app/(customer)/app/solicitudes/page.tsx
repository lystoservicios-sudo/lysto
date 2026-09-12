import { CustomerRequestList } from '@/components/customer/customer-request-list'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { ButtonLink } from '@/components/ui/button'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerRequestsLive } from '@/lib/customer/live-model'

export default async function CustomerRequestsPage({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const { cursor } = await searchParams
  const requests = await listCustomerRequestsLive(await requirePageSession('customer'), {
    pageSize: 25,
    ...(cursor ? { cursor } : {})
  })
  return (
    <PageScaffold
      title="Mis solicitudes"
      eyebrow="Cliente"
      description="Revisá borradores, solicitudes que necesitan atención y el próximo paso de cada servicio."
    >
      <CustomerRequestList requests={requests.items} />
      {requests.nextCursor ? (
        <ButtonLink
          href={`/app/solicitudes?cursor=${encodeURIComponent(requests.nextCursor)}`}
          variant="secondary"
        >
          Ver solicitudes anteriores
        </ButtonLink>
      ) : null}
    </PageScaffold>
  )
}
