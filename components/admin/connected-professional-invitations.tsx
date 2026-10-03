'use client'
import { useEffect, useState } from 'react'
import type { InvitationSummary, WorkflowPage } from '@/lib/professional/admin-workflow'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { Button, Field, Header, Panel } from './admin-ui'

/** The invitation list is kept in the prop contract for older callers; this screen only creates accounts. */
export function ConnectedProfessionalInvitations({
  categories
}: {
  initial?: WorkflowPage<InvitationSummary>
  categories: { id: string; name: string; slug?: string }[]
}) {
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => setBusy(false), [])

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await privateRequest<{
        delivery?: { accepted: boolean; reason: 'email_not_configured' | 'delivery_failed' | null }
      }>('/api/admin/invite-professional', 'POST', {
        firstName: values.get('firstName'),
        lastName: values.get('lastName'),
        email: values.get('email'),
        specialtySlug: values.get('specialtySlug')
      })
      form.reset()
      if (result.delivery?.accepted) setMessage('Invitación enviada con el acceso provisorio. El proveedor aceptó el correo.')
      else setError(result.delivery?.reason === 'email_not_configured'
        ? 'El correo no está configurado. La invitación quedó pendiente; configurá el envío y reenviá desde su expediente.'
        : 'No pudimos confirmar el envío. La invitación quedó pendiente; reenviá desde su expediente para generar una clave nueva.')
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <Header title="Añadir profesional" description="Creá su invitación para que complete la cuenta."
      back={{ href: '/admin/profesionales', label: 'Profesionales' }} />
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <Panel title="Nuevo profesional">
      <form className="adm-form" onSubmit={(event) => void create(event)}>
        <fieldset disabled={busy}>
          <Field label="Nombre"><input name="firstName" required minLength={1} maxLength={100} autoComplete="given-name" /></Field>
          <Field label="Apellido"><input name="lastName" required minLength={1} maxLength={100} autoComplete="family-name" /></Field>
          <Field label="Correo"><input type="email" name="email" required maxLength={254} autoComplete="email" /></Field>
          <Field label="Especialidad"><select name="specialtySlug" required>
            <option value="">Seleccionar</option>
            {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
          </select></Field>
          <Button type="submit" variant="primary">Crear invitación</Button>
        </fieldset>
      </form>
    </Panel>
  </>
}
