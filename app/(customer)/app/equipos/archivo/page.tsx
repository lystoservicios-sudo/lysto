import Link from 'next/link'
import { Archive } from 'lucide-react'
import { MoreEmpty, MoreLink, MorePage, moreStyles } from '@/components/customer/more/more-ui'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerEquipment } from '@/lib/customer-assets/service'

export default async function ArchivedEquipmentPage({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const session = await requirePageSession('customer')
  const { cursor } = await searchParams
  const page = await listCustomerEquipment(session, cursor ? { cursor } : {}, true)
  return (
    <MorePage
      title="Equipos archivados"
      description="Consultá los equipos que ya no usás y sus intervenciones anteriores."
      backHref="/app/equipos"
      backLabel="Volver a mis equipos"
    >
      {!page.total ? (
        <MoreEmpty title="No tenés equipos archivados" description="Si archivás un equipo, vas a poder consultar acá su historial sin perder los servicios anteriores." />
      ) : (
        <ul>
          {page.items.map((equipment) => (
            <li key={equipment.id}>
              <MoreLink href={`/app/equipos/${equipment.id}`} title={equipment.nickname} description="Equipo archivado · Ver historial" icon={Archive} />
            </li>
          ))}
        </ul>
      )}
      {page.nextCursor ? (
        <Link
          href={`/app/equipos/archivo?cursor=${encodeURIComponent(page.nextCursor)}`}
          className={moreStyles.textAction}
        >
          Ver más equipos archivados
        </Link>
      ) : null}
    </MorePage>
  )
}
