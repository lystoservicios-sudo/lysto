'use client'

import { useState } from 'react'
import { privateRequest, requestError } from '@/lib/http/private-client'

export function ProfessionalPasswordForm() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true); setMessage(''); setError('')
    try {
      await privateRequest('/api/professional/account/password', 'POST', {
        currentPassword: values.get('currentPassword'),
        newPassword: values.get('newPassword'),
        confirmPassword: values.get('confirmPassword')
      })
      form.reset()
      setMessage('Tu contraseña se actualizó.')
    } catch (failure) { setError(requestError(failure)) }
    finally { setBusy(false) }
  }
  return <form className="pro-panel space-y-4" onSubmit={(event) => void submit(event)}>
    <label className="block">Contraseña actual
      <input className="mt-1 block w-full rounded border p-3" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} />
    </label>
    <label className="block">Nueva contraseña
      <input className="mt-1 block w-full rounded border p-3" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} />
    </label>
    <label className="block">Repetir nueva contraseña
      <input className="mt-1 block w-full rounded border p-3" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} />
    </label>
    <p className="pro-muted">Usá entre 12 y 128 caracteres.</p>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    <button className="rounded bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50" type="submit" disabled={busy}>
      {busy ? 'Actualizando…' : 'Cambiar contraseña'}
    </button>
  </form>
}
