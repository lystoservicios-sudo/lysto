'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { ProfessionalSummary, WorkflowPage } from '@/lib/professional/admin-workflow'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { professionalStatusLabels } from '@/components/pro/connected-professional-onboarding'
import { Button, Header, Panel } from './admin-ui'

export function ConnectedProfessionalDirectory({
  initial
}: {
  initial: WorkflowPage<ProfessionalSummary>
}) {
  const [page, setPage] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function load(more = false) {
    setBusy(true)
    setError('')
    try {
      const next = await privateRequest<WorkflowPage<ProfessionalSummary>>(
        '/api/admin/professionals' +
          (more && page.nextCursor ? '?cursor=' + encodeURIComponent(page.nextCursor) : '')
      )
      setPage((current) => ({
        ...next,
        items: more ? [...current.items, ...next.items] : next.items
      }))
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Header
        title="Profesionales"
        description="Postulaciones y habilitaciones registradas."
        action={
          <Link className="adm-button adm-button-primary" href="/admin/profesionales/invitaciones">
            Invitaciones
          </Link>
        }
      />
      {error && <p role="alert">{error}</p>}
      <Panel
        title="Directorio profesional"
        action={
          <Button disabled={busy} onClick={() => void load()}>
            Actualizar
          </Button>
        }
      >
        <p>
          {page.total} profesionales · {page.items.length} mostrados
        </p>
        {!page.items.length && <p>Todavía no hay profesionales registrados.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Profesional</th>
                <th>Revisión</th>
                <th>Habilitación vigente</th>
                <th>Expediente</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((person) => (
                <tr key={person.id}>
                  <td className="p-3">
                    {person.firstName} {person.lastName}
                    <br />
                    {person.email}
                  </td>
                  <td>{professionalStatusLabels[person.status]}</td>
                  <td>
                    {person.eligible ? 'Habilitado' : 'No habilitado'}
                    {!person.invited && ' · Alta previa al circuito de invitación'}
                  </td>
                  <td>
                    <Link className="underline" href={'/admin/profesionales/' + person.id}>
                      Ver expediente
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {page.nextCursor && (
          <Button disabled={busy} onClick={() => void load(true)}>
            Cargar más
          </Button>
        )}
      </Panel>
    </>
  )
}
