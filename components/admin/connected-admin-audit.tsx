'use client'

import { useState } from 'react'
import type { AdminAuditRecord, AdminPage } from '@/lib/admin/permissions-service'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { Button, Header, Panel } from './admin-ui'

const metadataLabels: Record<string, string> = {
  before: 'Permisos anteriores',
  after: 'Permisos nuevos',
  reason: 'Motivo'
}

export function ConnectedAdminAudit({ initial }: { initial: AdminPage<AdminAuditRecord> }) {
  const [page, setPage] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function load(more: boolean) {
    setPending(true)
    setError('')
    try {
      const result = await privateRequest<AdminPage<AdminAuditRecord>>(
        '/api/admin/audit' +
          (more && page.nextCursor ? '?cursor=' + encodeURIComponent(page.nextCursor) : '')
      )
      setPage((current) => ({
        ...result,
        items: more
          ? [
              ...current.items,
              ...result.items.filter(
                (item) => !current.items.some((existing) => existing.id === item.id)
              )
            ]
          : result.items
      }))
    } catch (error) {
      setError(requestError(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <Header
        title="Auditoría"
        section="Control"
        description="Historial de acciones disponible según tus permisos actuales. Cada registro identifica la operación y su responsable."
        action={
          <Button disabled={pending} onClick={() => load(false)}>
            {pending ? 'Cargando…' : 'Recargar auditoría'}
          </Button>
        }
      />
      {error && (
        <p role="alert" className="adm-notice">
          {error}
        </p>
      )}
      <Panel
        title="Historial de acciones"
        description={`${page.items.length} de ${page.total} registros accesibles`}
      >
        {!page.items.length && <p>No hay acciones registradas para tus permisos actuales.</p>}
        <div className="adm-audit-records">
          {page.items.map((item) => (
            <article key={item.id} className="adm-audit-record">
              <h3>{item.action}</h3>
              <dl className="adm-facts">
                <div>
                  <dt>Fecha</dt>
                  <dd>
                    <time dateTime={item.createdAt}>
                      {new Intl.DateTimeFormat('es-AR', {
                        dateStyle: 'medium',
                        timeStyle: 'medium',
                        timeZone: 'America/Argentina/Buenos_Aires'
                      }).format(new Date(item.createdAt))}{' '}
                      (Argentina)
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Responsable</dt>
                  <dd>{item.actorProfileId ?? 'Proceso del sistema'}</dd>
                </div>
                <div>
                  <dt>Entidad</dt>
                  <dd>
                    {item.entityType}
                    {item.entityId ? ` · ${item.entityId}` : ''}
                  </dd>
                </div>
              </dl>
              <details className="adm-detail-toggle">
                <summary>Ver detalle del registro</summary>
                <dl className="adm-facts">
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <div key={key}>
                      <dt>{metadataLabels[key] ?? key}</dt>
                      <dd>
                        {Array.isArray(value)
                          ? value.join(', ') || 'Sin permisos'
                          : String(value ?? '—')}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </article>
          ))}
        </div>
        {page.nextCursor && (
          <Button disabled={pending} onClick={() => load(true)}>
            Cargar más registros
          </Button>
        )}
      </Panel>
    </>
  )
}
