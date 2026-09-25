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
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [statusFilter, setStatusFilter] = useState('all'),
    [sort, setSort] = useState('recent')
  const normalized = query.trim().toLocaleLowerCase('es-AR')
  const visible = page.items.filter((person) => {
    const active = person.status === 'approved'
    return (statusFilter === 'all' || (statusFilter === 'active' ? active : !active)) &&
      (!normalized || `${person.firstName} ${person.lastName} ${person.email} ${person.specialtySlug ?? ''}`
        .toLocaleLowerCase('es-AR').includes(normalized))
  }).sort((a, b) => sort === 'name'
    ? `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es-AR')
    : b.createdAt.localeCompare(a.createdAt))
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
        description="Convocados, en registro y habilitados para trabajar."
        action={<Link className="adm-button adm-button-primary" href="/admin/profesionales/invitaciones">Añadir nuevo</Link>}
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
        <div className="mb-4 flex flex-wrap gap-3">
          <label>Buscar profesionales
            <input className="ml-2 rounded border p-2" type="search" value={query}
              onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, correo o especialidad" />
          </label>
          <label>Estado
            <select className="ml-2 rounded border p-2" value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos</option><option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </label>
          <label>Ordenar
            <select className="ml-2 rounded border p-2" value={sort}
              onChange={(event) => setSort(event.target.value)}>
              <option value="recent">Más recientes</option><option value="name">Nombre</option>
            </select>
          </label>
        </div>
        {!page.items.length && <p>Todavía no hay profesionales registrados.</p>}
        {page.items.length > 0 && !visible.length && <p>No hay profesionales cargados con estos filtros.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Profesional</th>
                <th>Especialidad</th>
                <th>Cuenta</th>
                <th>Revisión</th>
                <th>Habilitación vigente</th>
                <th>Trabajos nuevos</th>
                <th>Expediente</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => (
                <tr key={person.id}>
                  <td className="p-3">
                    {person.firstName} {person.lastName}
                    <br />
                    {person.email}
                  </td>
                  <td>{person.specialtySlug?.replaceAll('_', ' ') || 'Por definir'}</td>
                  <td>{person.status === 'approved' ? 'Activo' : 'Inactivo'}</td>
                  <td>{professionalStatusLabels[person.status]}</td>
                  <td>
                    {person.source === 'invitation' ? 'Registro sin completar' : person.eligible ? 'Documentación vigente' : 'Documentación pendiente'}
                  </td>
                  <td>{(person.readyForNewWork ?? person.eligible) ? 'Puede recibir' : 'No puede recibir'}</td>
                  <td>
                    <Link className="underline" href={'/admin/profesionales/' + person.id}>
                      Ver perfil
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
