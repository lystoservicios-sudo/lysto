import Link from 'next/link'
import type { AdminRequestRecord } from '@/lib/admin/service-request-contract'
import { ActionLink, Panel } from './admin-ui'

export function ManagedServiceRequestList({ records, total = records.length, nextHref }: {
  records: AdminRequestRecord[]; total?: number; nextHref?: string
}) {
  return <Panel title="Solicitudes creadas por administración" description="Borradores y servicios preparados en nombre del cliente." action={<ActionLink href="/admin/solicitudes/nueva" primary>Crear solicitud</ActionLink>}>
    <div className="adm-stack">
      <p>{records.length} de {total} solicitudes cargadas</p>
      {records.map(record => <article className="adm-list-item" key={record.id}>
        <div><strong>{record.input.serviceTitle}</strong>{record.customerName ? <p>{record.customerName}</p> : null}<p>{record.state === 'draft' ? 'Borrador' : record.acceptedAt ? 'Confirmada por el cliente' : 'Enviada'} · {record.input.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p><small>Actualizada: {new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }).format(new Date(record.updatedAt))}</small></div>
        <Link className="adm-button adm-button-secondary" href={record.state === 'sent' ? `/admin/trabajos/${record.jobId}` : `/admin/solicitudes/nueva?draft=${record.id}`}>{record.state === 'draft' ? 'Continuar borrador' : 'Ver trabajo'}</Link>
      </article>)}
      {!records.length ? <p>{total ? 'No hay solicitudes en esta página.' : 'Todavía no creaste solicitudes desde administración.'}</p> : null}
      {nextHref ? <Link className="adm-button adm-button-secondary" href={nextHref}>Ver siguientes solicitudes</Link> : null}
    </div>
  </Panel>
}
