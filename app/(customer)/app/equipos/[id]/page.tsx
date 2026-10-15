import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MorePage, MoreSection, moreStyles } from '@/components/customer/more/more-ui'
import styles from '@/components/customer/customer-secondary.module.css'
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
    <MorePage
      title={equipment.nickname}
      backHref="/app/equipos"
      backLabel="Volver a mis equipos"
      description={
        [equipment.brand, equipment.model].filter(Boolean).join(' · ') ||
        'Marca y modelo sin informar'
      }
    >
      {equipment.archived_at ? <p className={moreStyles.notice}>Equipo archivado. Su historial y sus fotos siguen disponibles para consulta.</p> : null}
      <MoreSection title="Ficha del equipo">
        <dl className={moreStyles.facts}>
          <div className={moreStyles.fact}>
            <dt>Tipo</dt>
            <dd>{equipment.equipment_type || 'Sin informar'}</dd>
          </div>
          <div className={moreStyles.fact}>
            <dt>Serie</dt>
            <dd>{equipment.serial_number || 'Sin informar'}</dd>
          </div>
          <div className={moreStyles.fact}>
            <dt>Frigorías</dt>
            <dd>{equipment.frigorias || 'Sin informar'}</dd>
          </div>
        </dl>
      </MoreSection>
      <MoreSection title="Historial del equipo">
        {!items.length ? (
          <p className={moreStyles.muted}>Todavía no hay intervenciones registradas en esta página.</p>
        ) : (
          items.map((record) => (
            <article key={record.id} className={styles.historyRow}>
              <p className={moreStyles.muted}>
                {new Date(record.created_at).toLocaleDateString('es-AR', {
                  timeZone: 'America/Argentina/Buenos_Aires'
                })}
              </p>
              <h3>{record.reported_problem || 'Servicio registrado'}</h3>
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
          <Link
            href={`/app/equipos/${equipment.id}?cursor=${encodeURIComponent(nextCursor)}`}
            className={moreStyles.textAction}
          >
            Ver historial anterior
          </Link>
        ) : null}
      </MoreSection>
      <div className={styles.photos}>
        <CustomerEquipmentPhotos
          equipmentId={equipment.id}
          archived={Boolean(equipment.archived_at)}
        />
      </div>
    </MorePage>
  )
}
