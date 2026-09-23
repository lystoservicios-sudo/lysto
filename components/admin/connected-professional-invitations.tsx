'use client'
import { useEffect, useState } from 'react'
import type { InvitationSummary, WorkflowPage } from '@/lib/professional/admin-workflow'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { Button, Field, Header, Panel } from './admin-ui'

const labels = {
  queued: 'En cola de entrega',
  sent: 'Enviada',
  opened: 'Aceptada',
  completed: 'Postulación aprobada',
  expired: 'Vencida',
  cancelled: 'Cancelada'
}
export function ConnectedProfessionalInvitations({
  initial,
  categories
}: {
  initial: WorkflowPage<InvitationSummary>
  categories: { id: string; name: string; slug?: string }[]
}) {
  const [page, setPage] = useState(initial),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  // Do not accept edits before hydration installs the change handlers.
  useEffect(() => {
    setBusy(false)
  }, [])
  const [selected, setSelected] = useState<InvitationSummary | null>(null)
  async function load(more = false) {
    const next = await privateRequest<WorkflowPage<InvitationSummary>>(
      '/api/admin/professionals/invitations' +
        (more && page.nextCursor ? '?cursor=' + encodeURIComponent(page.nextCursor) : '')
    )
    setPage((current) => ({
      ...next,
      items: more ? [...current.items, ...next.items] : next.items
    }))
    setSelected(null)
  }
  async function mutate(event: React.FormEvent<HTMLFormElement>, cancel = false) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget,
      values = new FormData(form)
    setBusy(true)
    setError('')
    setMessage('')
    setCreatedLink(null)
    try {
      const result = await privateRequest<{ link?: string }>(
        '/api/admin/invite-professional',
        cancel ? 'PATCH' : 'POST',
        cancel
          ? {
              invitationId: selected!.id,
              expectedVersion: selected!.version,
              reason: values.get('reason')
            }
          : {
              email: values.get('email'),
              specialtySlug: values.get('specialtySlug'),
              reason: values.get('reason')
            }
      )
      form.reset()
      await load()
      if (!cancel) setCreatedLink(result.link ?? null)
      setMessage(cancel ? 'Invitación cancelada.' : 'Invitación registrada y en cola de entrega.')
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function refresh(more = false) {
    setBusy(true)
    setError('')
    setCreatedLink(null)
    try {
      await load(more)
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Header
        title="Invitaciones profesionales"
        description="Convocá a un profesional y seguí su postulación."
        back={{ href: '/admin/profesionales', label: 'Profesionales' }}
      />
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {createdLink && (
        <Panel title="Enlace creado">
          <p>Copiá el enlace ahora: por seguridad no vuelve a mostrarse al actualizar la lista.</p>
          <p><a className="underline" href={createdLink} target="_blank" rel="noopener noreferrer">Abrir enlace de invitación</a></p>
          <Button disabled={busy} onClick={async () => {
            try {
              await navigator.clipboard.writeText(createdLink)
              setMessage('Enlace copiado. Compartilo sólo con el correo invitado.')
            } catch {
              setError('No pudimos copiar el enlace. Abrilo y copialo desde la barra del navegador.')
            }
          }}>Copiar enlace</Button>
        </Panel>
      )}
      <Panel title="Nueva invitación">
        <form className="adm-form" onSubmit={(event) => void mutate(event)}>
          <fieldset disabled={busy}>
            <Field label="Correo del profesional">
              <input type="email" name="email" required maxLength={254} />
            </Field>
            <Field label="Especialidad">
              <select name="specialtySlug" required>
                <option value="">Seleccionar</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Motivo de la convocatoria">
              <textarea name="reason" required minLength={10} maxLength={1000} />
            </Field>
            <Button type="submit" variant="primary">
              Crear invitación
            </Button>
          </fieldset>
        </form>
        <p>La invitación queda pendiente hasta que el servicio de correo confirme la entrega.</p>
      </Panel>
      <Panel
        title="Invitaciones registradas"
        action={
          <Button disabled={busy} onClick={() => void refresh()}>
            Actualizar
          </Button>
        }
      >
        <p>
          {page.total} invitaciones · {page.items.length} mostradas
        </p>
        {!page.items.length && <p>Todavía no hay invitaciones.</p>}
        <ul>
          {page.items.map((invitation) => (
            <li className="border-b py-4" key={invitation.id}>
              <strong>{invitation.email}</strong> ·{' '}
              {new Date(invitation.expiresAt).getTime() <= Date.now() &&
              ['queued', 'sent'].includes(invitation.status)
                ? 'Vencida'
                : labels[invitation.status]}
              <p>Vence: {new Date(invitation.expiresAt).toLocaleDateString('es-AR')}</p>
              {['queued', 'sent'].includes(invitation.status) && (
                <Button disabled={busy} onClick={() => setSelected(invitation)}>
                  Cancelar invitación a {invitation.email}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {page.nextCursor && (
          <Button disabled={busy} onClick={() => void refresh(true)}>
            Cargar más
          </Button>
        )}
      </Panel>
      {selected && (
        <Panel title={'Cancelar invitación a ' + selected.email}>
          <form className="adm-form" onSubmit={(event) => void mutate(event, true)}>
            <Field label="Motivo de cancelación">
              <textarea name="reason" required minLength={10} maxLength={1000} disabled={busy} />
            </Field>
            <Button type="submit" disabled={busy}>
              Confirmar cancelación
            </Button>
            <Button disabled={busy} onClick={() => setSelected(null)}>
              Volver
            </Button>
          </form>
        </Panel>
      )}
    </>
  )
}
