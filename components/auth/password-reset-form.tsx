'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { AuthInput, AuthNotice } from './auth-fields'

export function PasswordResetForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [continuation, setContinuation] = useState('')
  const [factors, setFactors] = useState<Array<{ id: string; name: string }>>([])
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const password = form.elements.namedItem('password') as HTMLInputElement
    const repeat = form.elements.namedItem('repeatPassword') as HTMLInputElement
    if (password.value !== repeat.value) {
      event.preventDefault()
      setError('Las contraseñas no coinciden. Revisalas para continuar.')
      repeat.focus()
      return
    }
    setError('')
    setPending(true)
    try {
      const response = await fetch(form.action, {
        method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form)
      })
      const result = await response.json() as { message?: string; continuation?: string; factors?: Array<{ id: string; name: string }>; redirectTo?: string }
      if (response.ok && ['/login?reset=success', '/equipo/login?reset=success'].includes(result.redirectTo ?? '')) {
        window.location.assign(result.redirectTo!)
        return
      }
      if (result.continuation) {
        setContinuation(result.continuation)
        setFactors(result.factors ?? [])
        setFactorId(result.factors?.[0]?.id ?? '')
        setCode('')
      }
      setError(result.message || 'No pudimos completar la recuperación. Intentá nuevamente.')
    } catch {
      setError('No pudimos conectarnos con Lysto. Intentá nuevamente.')
    } finally { setPending(false) }
  }

  return <form action="/auth/reset-password" method="post" onSubmit={submit} aria-busy={pending} className="auth-form">
    {continuation ? <input type="hidden" name="continuation" value={continuation} /> : <input type="hidden" name="token_hash" value={token} />}
    <AuthInput label="Nueva contraseña" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={12} revealable />
    <p className="auth-help">Usá entre 6 y 12 caracteres.</p>
    <AuthInput label="Repetir contraseña" name="repeatPassword" type="password" autoComplete="new-password" minLength={6} maxLength={12} revealable />
    {factors.length > 0 && <>
      {factors.length > 1 ? <label className="auth-field">Autenticador<select name="factorId" value={factorId} onChange={event => setFactorId(event.target.value)}>{factors.map(factor => <option key={factor.id} value={factor.id}>{factor.name}</option>)}</select></label> : <input type="hidden" name="factorId" value={factorId} />}
      <label>Código del autenticador<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
      <p className="auth-help">Usá el código de tu aplicación de autenticación. Si perdiste acceso, contactá al equipo de soporte.</p>
    </>}
    <AuthNotice state={{ status: 'error', message: error }} />
    <button type="submit" className="auth-button" disabled={pending}>{pending ? 'Guardando…' : 'Guardar contraseña'}<ArrowRight size={16} aria-hidden="true" /></button>
  </form>
}
