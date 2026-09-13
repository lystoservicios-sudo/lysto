import Link from 'next/link'

import type { OperatorQueueItem } from '@/lib/operations/queue-service'
import { Header, Metrics, Panel } from './admin-ui'

export function OperationsDashboard({
  queue,
  nextHref
}: {
  queue: { items: OperatorQueueItem[]; total: number }
  nextHref?: string
}) {
  const overdue = queue.items.filter(
    (item) => item.dueAt && item.dueAt < new Date().toISOString()
  ).length
  const high = queue.items.filter((item) => ['high', 'critical'].includes(item.priority)).length
  return (
    <>
      <Header
        title="Operaciones"
        description="Cola compartida con prioridad, responsable, vencimiento y próximo paso."
      />
      <Metrics
        items={[
          { label: 'Pendientes', value: queue.total, detail: 'Solicitudes, trabajos y soporte' },
          { label: 'Prioridad alta', value: high, detail: 'En la página actual' },
          { label: 'SLA vencido', value: overdue, detail: 'Requiere atención' },
          {
            label: 'Sin responsable',
            value: queue.items.filter((item) => !item.assignedTo).length,
            detail: 'En la página actual'
          }
        ]}
      />
      <Panel
        title="Cola operativa"
        description={`${queue.items.length} de ${queue.total} registros`}
      >
        <div className="adm-stack">
          {queue.items.map((item) => (
            <article key={`${item.entityType}-${item.id}`} className="adm-list-item">
              <div>
                <strong>
                  {item.entityType} · {item.status}
                </strong>
                <p>{item.nextAction}</p>
                <small>
                  {item.priority} ·{' '}
                  {item.dueAt
                    ? `vence ${new Date(item.dueAt).toLocaleString('es-AR')}`
                    : 'sin vencimiento'}{' '}
                  · {item.assignedTo ? 'responsable asignado' : 'sin responsable'}
                </small>
              </div>
              <Link
                href={
                  item.entityType === 'request'
                    ? `/admin/solicitudes/${item.id}`
                    : item.entityType === 'job'
                      ? `/admin/trabajos/${item.id}`
                      : '/admin/reclamos'
                }
              >
                Abrir
              </Link>
            </article>
          ))}
          {!queue.items.length ? <p>No hay operaciones pendientes.</p> : null}
          {nextHref ? <Link href={nextHref}>Ver siguientes registros</Link> : null}
        </div>
      </Panel>
    </>
  )
}

export function LiveRecords({
  title,
  description,
  rows,
  href,
  nextHref,
  total
}: {
  title: string
  description: string
  rows: readonly { id: string; status?: string; createdAt?: string; nickname?: string }[]
  href?: (id: string) => string
  nextHref?: string
  total?: number
}) {
  return (
    <>
      <Header title={title} description={description} />
      <Panel
        title="Registros"
        description={`${rows.length} de ${total ?? rows.length} registros cargados`}
      >
        <div className="adm-stack">
          {rows.map((row) => (
            <article key={row.id} className="adm-list-item">
              <div>
                <strong>{row.nickname ?? row.id}</strong>
                <p>{row.status ?? 'Registrado'}</p>
                {row.createdAt ? (
                  <small>{new Date(row.createdAt).toLocaleString('es-AR')}</small>
                ) : null}
              </div>
              {href ? <Link href={href(row.id)}>Abrir</Link> : null}
            </article>
          ))}
          {!rows.length ? <p>No hay registros disponibles para tus permisos.</p> : null}
          {nextHref ? <Link href={nextHref}>Ver siguientes registros</Link> : null}
        </div>
      </Panel>
    </>
  )
}

export function CatalogConsole({
  title,
  rows
}: {
  title: string
  rows: readonly { id: string; name?: string; label?: string; slug?: string; active?: boolean }[]
}) {
  return (
    <>
      <Header
        title={title}
        description="Catálogo versionado visible para operaciones. Los cambios se realizan por los contratos administrativos autorizados."
      />
      <Panel title="Configuración vigente">
        <div className="adm-stack">
          {rows.map((row) => (
            <article key={row.id} className="adm-list-item">
              <div>
                <strong>{row.name ?? row.label ?? row.slug ?? row.id}</strong>
                <p>{row.slug ?? ''}</p>
              </div>
              <span>{row.active === false ? 'Inactivo' : 'Activo'}</span>
            </article>
          ))}
          {!rows.length ? <p>No hay elementos configurados.</p> : null}
        </div>
      </Panel>
    </>
  )
}
