import { notFound } from 'next/navigation'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { ButtonLink } from '@/components/ui/button'
import { CustomerEquipmentPhotos } from '@/components/customer/customer-equipment-photos'
import { requirePageSession } from '@/lib/auth/session'
import { customerEquipmentHistory } from '@/lib/customer-assets/service'
import { ApiError } from '@/lib/http/api-error'

export default async function CustomerEquipmentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cursor?: string }>
}) {
  const { id } = await params
  const session = await requirePageSession('customer')
  const { cursor } = await searchParams
  const detail = await customerEquipmentHistory(session, id, cursor ? { cursor } : {}).catch(
    (error) => {
      if (error instanceof ApiError && error.code === 'not_found') notFound()
      throw error
    }
  )
  const { equipment, items, nextCursor } = detail
  return (
    <PageScaffold
      title={equipment.nickname}
      eyebrow={equipment.archived_at ? 'Equipo archivado' : 'Mi equipo'}
      description={
        [equipment.brand, equipment.model].filter(Boolean).join(' · ') ||
        'Marca y modelo sin informar'
      }
    >
      <ButtonLink href="/app/equipos" variant="secondary">
        Volver a mis equipos
      </ButtonLink>
      <dl className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-3">
        <div>
          <dt className="font-semibold">Tipo</dt>
          <dd>{equipment.equipment_type || 'Sin informar'}</dd>
        </div>
        <div>
          <dt className="font-semibold">Serie</dt>
          <dd>{equipment.serial_number || 'Sin informar'}</dd>
        </div>
        <div>
          <dt className="font-semibold">Frigorías</dt>
          <dd>{equipment.frigorias || 'Sin informar'}</dd>
        </div>
      </dl>
      <section aria-label="Historial del equipo" className="space-y-3">
        <h2 className="text-xl font-bold">Historial del equipo</h2>
        {!items.length ? (
          <p>Todavía no hay intervenciones registradas en esta página.</p>
        ) : (
          items.map((record) => (
            <article key={record.id} className="space-y-2 rounded-2xl border bg-white p-5">
              <p>
                {new Date(record.created_at).toLocaleDateString('es-AR', {
                  timeZone: 'America/Argentina/Buenos_Aires'
                })}
              </p>
              <p>{record.reported_problem || 'Servicio registrado'}</p>
              {record.real_diagnosis ? <p>Diagnóstico: {record.real_diagnosis}</p> : null}
              {record.work_done ? <p>Trabajo realizado: {record.work_done}</p> : null}
              {record.parts_used ? <p>Repuestos: {record.parts_used}</p> : null}
              {record.next_maintenance_date ? (
                <p>Próximo mantenimiento: {record.next_maintenance_date}</p>
              ) : null}
            </article>
          ))
        )}
        {nextCursor ? (
          <ButtonLink
            href={`/app/equipos/${equipment.id}?cursor=${encodeURIComponent(nextCursor)}`}
            variant="secondary"
          >
            Ver historial anterior
          </ButtonLink>
        ) : null}
      </section>
      <CustomerEquipmentPhotos
        equipmentId={equipment.id}
        archived={Boolean(equipment.archived_at)}
      />
    </PageScaffold>
  )
}
