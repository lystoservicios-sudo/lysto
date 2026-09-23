'use client'
import { useEffect, useState } from 'react'
import type { InvitationSummary, WorkflowPage } from '@/lib/professional/admin-workflow'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { Button, Field, Header, Panel } from './admin-ui'

const labels = {
  queued: 'No enviada',
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
      const result = await privateRequest<{
        link?: string
        delivery?: { accepted: boolean; reason: 'email_not_configured' | 'delivery_failed' | null }
      }>(
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
      if (cancel) setMessage('Invitación cancelada.')
      else if (result.delivery?.accepted) setMessage('Correo aceptado para envío.')
      else setError(result.delivery?.reason === 'email_not_configured'
        ? 'El correo no está configurado. La invitación quedó guardada, pero no se envió. No crees otra; copiá el enlace si aparece.'
        : 'No pudimos confirmar el envío. La invitación quedó guardada, pero no la consideramos enviada. No crees otra.')
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
  async function resend(invitation: InvitationSummary) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await privateRequest<{
        delivery: { accepted: boolean; reason: 'email_not_configured' | 'delivery_failed' | null }
      }>('/api/admin/invite-professional', 'PUT', { invitationId: invitation.id })
      await load()
      if (result.delivery.accepted) setMessage('Correo aceptado para envío.')
      else setError(result.delivery.reason === 'email_not_configured'
        ? 'El correo no está configurado. Esta invitación sigue sin enviarse.'
        : 'No pudimos confirmar el envío. Esperá un minuto antes de reintentar esta misma invitación.')
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
        <p>Al crearla intentamos enviar el correo en ese momento. Solo se marca enviada cuando el proveedor lo acepta.</p>
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
              {invitation.status === 'queued' && new Date(invitation.expiresAt).getTime() > Date.now() && (
                <Button disabled={busy} onClick={() => void resend(invitation)}>
                  Reintentar envío a {invitation.email}
                </Button>
              )}
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
