'use client'
import { useEffect, useState } from 'react'
import type { InvitationSummary } from '@/lib/professional/admin-workflow'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { Button, Header, Panel } from './admin-ui'

export function ConnectedProfessionalInvitationDetail({ invitation }: { invitation: InvitationSummary }) {
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  useEffect(() => setBusy(false), [])
  async function resend() {
    setBusy(true); setError(''); setMessage(''); setLink('')
    try {
      const result = await privateRequest<{ delivery: { accepted: boolean }; link: string }>(
        '/api/admin/invite-professional', 'PUT', { invitationId: invitation.id })
      setLink(result.link)
      if (result.delivery.accepted) setMessage('Invitación aceptada por el proveedor de correo.')
      else setError('El envío no fue confirmado. Intentá nuevamente más tarde.')
    } catch (failure) { setError(requestError(failure)) }
    finally { setBusy(false) }
  }
  const expired = new Date(invitation.expiresAt).getTime() <= Date.now()
  return <>
    <Header title={`${invitation.firstName || ''} ${invitation.lastName || ''}`.trim() || invitation.email}
      description={invitation.email} back={{ href: '/admin/profesionales', label: 'Profesionales' }} />
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {link && <p>Enlace nuevo (copialo si necesitás compartirlo manualmente): <a href={link}>{link}</a></p>}
    <Panel title="Estado de la convocatoria">
      <p>{expired ? 'Invitación vencida' : invitation.status === 'sent' ? 'Invitación enviada' : 'Invitación pendiente de envío'}</p>
      <p>Especialidad: {invitation.specialtySlug.replaceAll('_', ' ')}</p>
      <p>Vence: {new Date(invitation.expiresAt).toLocaleDateString('es-AR')}</p>
      {['queued', 'sent', 'expired'].includes(invitation.status) &&
        <Button disabled={busy} onClick={() => void resend()}>Reenviar invitación</Button>}
    </Panel>
    <Panel title="Registro pendiente">
      <p>Todavía no creó su contraseña ni aceptó la invitación. Faltan los datos personales, domicilio, disponibilidad, herramientas, documentación, foto de perfil y Mercado Pago.</p>
      <p>Trabajos: ninguno. La cuenta no puede recibir asignaciones hasta completar el expediente y superar la revisión de administración.</p>
    </Panel>
  </>
}
