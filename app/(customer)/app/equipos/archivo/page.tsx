import { PageScaffold } from '@/components/layout/page-scaffold'
import { ButtonLink } from '@/components/ui/button'
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
    <PageScaffold
      title="Equipos archivados"
      eyebrow="Cliente"
      description="Consultá los equipos que ya no usás y sus intervenciones anteriores."
    >
      <ButtonLink href="/app/equipos" variant="secondary">
        Volver a mis equipos
      </ButtonLink>
      {!page.total ? (
        <p>No tenés equipos archivados.</p>
      ) : (
        <ul className="space-y-3">
          {page.items.map((equipment) => (
            <li key={equipment.id} className="rounded-2xl border bg-white p-4">
              <ButtonLink href={`/app/equipos/${equipment.id}`} variant="ghost">
                {equipment.nickname} · Ver historial
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
      {page.nextCursor ? (
        <ButtonLink
          href={`/app/equipos/archivo?cursor=${encodeURIComponent(page.nextCursor)}`}
          variant="secondary"
        >
          Ver más equipos archivados
        </ButtonLink>
      ) : null}
    </PageScaffold>
  )
}
