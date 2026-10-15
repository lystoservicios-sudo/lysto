import { CustomerRequestList } from '@/components/customer/customer-request-list'
import Link from 'next/link'
import { MorePage, moreStyles } from '@/components/customer/more/more-ui'
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
    <MorePage
      title="Mis solicitudes"
      description="Consultá el estado de tus solicitudes. Las visitas, los pagos y el seguimiento están en Servicios."
      backHref="/app/trabajos"
      backLabel="Volver a Servicios"
    >
      <CustomerRequestList requests={requests.items} />
      {requests.nextCursor ? (
        <Link
          href={`/app/solicitudes?cursor=${encodeURIComponent(requests.nextCursor)}`}
          className={moreStyles.textAction}
        >
          Ver solicitudes anteriores
        </Link>
      ) : null}
    </MorePage>
  )
}
