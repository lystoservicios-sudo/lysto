'use client'

import { useState } from 'react'
import type { AdminAccount, AdminPage } from '@/lib/admin/permissions-service'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { Button, Field, Header, Notice, Panel } from './admin-ui'

const labels = {
  operations: 'Operaciones',
  finance: 'Finanzas',
  quality: 'Calidad',
  owner: 'Owner'
} as const

function PermissionEditor({
  account,
  onSaved
}: {
  account: AdminAccount
  onSaved: (account: AdminAccount) => void
}) {
  const [permissions, setPermissions] = useState(account.permissions)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const changed = Object.keys(labels).some(
    (value) =>
      permissions.includes(value as keyof typeof labels) !==
      account.permissions.includes(value as keyof typeof labels)
  )
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (pending || !changed || reason.trim().length < 10) return
    setPending(true)
    setError('')
    try {
      const result = await privateRequest<{ account: AdminAccount }>(
        '/api/admin/permissions',
        'PUT',
        {
          adminProfileId: account.id,
          expectedVersion: account.version,
          permissions,
          reason: reason.trim()
        }
      )
      onSaved(result.account)
    } catch (error) {
      setError(requestError(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <form onSubmit={save} className="adm-form">
      <fieldset disabled={pending}>
        <legend>
          Permisos de {account.firstName} {account.lastName}
        </legend>
        <div className="adm-checklist">
          {Object.entries(labels).map(([value, label]) => {
            const permission = value as keyof typeof labels
            return (
              <label key={permission}>
                <input
                  type="checkbox"
                  checked={permissions.includes(permission)}
                  onChange={(event) =>
                    setPermissions((current) =>
                      event.target.checked
                        ? [...current, permission]
                        : current.filter((item) => item !== permission)
                    )
                  }
                />
                <span>{label}</span>
              </label>
            )
          })}
        </div>
        <p>
          Owner puede administrar todos los ámbitos. Sin permisos, la cuenta pierde acceso a las
          operaciones administrativas.
        </p>
        <Field label="Motivo del cambio">
          <textarea
            required
            minLength={10}
            maxLength={1000}
            aria-describedby="permission-reason-hint"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <p id="permission-reason-hint">
          Explicá la responsabilidad o el cambio de función. El motivo queda en auditoría.
        </p>
        <Button
          type="submit"
          variant="primary"
          disabled={pending || !changed || reason.trim().length < 10}
        >
          {pending ? 'Guardando…' : 'Guardar permisos'}
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="adm-notice">
          {error}
        </p>
      )}
    </form>
  )
}

export function ConnectedAdminPermissions({ initial }: { initial: AdminPage<AdminAccount> }) {
  const [page, setPage] = useState(initial)
  const [selected, setSelected] = useState(initial.items[0]?.id ?? '')
  const [revision, setRevision] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  async function load(more: boolean) {
    setPending(true)
    setError('')
    setSaved(false)
    try {
      const result = await privateRequest<AdminPage<AdminAccount>>(
        '/api/admin/permissions' +
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
      if (!more) {
        setSelected(
          result.items.some((item) => item.id === selected) ? selected : (result.items[0]?.id ?? '')
        )
        setRevision((value) => value + 1)
      }
    } catch (error) {
      setError(requestError(error))
    } finally {
      setPending(false)
    }
  }
  const account = page.items.find((item) => item.id === selected)
  return (
    <>
      <Header
        title="Permisos administrativos"
        section="Configuración"
        description="Asigná responsabilidades a cada administrador. Los cambios requieren un motivo y quedan registrados."
        action={
          <Button disabled={pending} onClick={() => load(false)}>
            {pending ? 'Cargando…' : 'Recargar datos'}
          </Button>
        }
      />
      {error && (
        <p role="alert" className="adm-notice">
          {error}
        </p>
      )}
      {saved && <Notice success>Permisos guardados y registrados en auditoría.</Notice>}
      <Panel title="Administradores" description={`${page.items.length} de ${page.total} cuentas`}>
        {page.items.length ? (
          <Field label="Cuenta administrativa">
            <select
              value={selected}
              disabled={pending}
              onChange={(event) => {
                setSelected(event.target.value)
                setSaved(false)
              }}
            >
              {page.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.firstName} {item.lastName} · {item.id}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p>No hay cuentas administrativas disponibles.</p>
        )}
        {page.nextCursor && (
          <Button disabled={pending} onClick={() => load(true)}>
            Cargar más administradores
          </Button>
        )}
        {account && (
          <PermissionEditor
            key={`${account.id}:${account.version}:${revision}`}
            account={account}
            onSaved={(value) => {
              setPage((current) => ({
                ...current,
                items: current.items.map((item) => (item.id === value.id ? value : item))
              }))
              setSaved(true)
            }}
          />
        )}
      </Panel>
    </>
  )
}
