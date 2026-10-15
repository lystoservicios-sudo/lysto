'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { AuthInput, AuthNotice } from './auth-fields'

export function PasswordResetForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending) { event.preventDefault(); return }
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
  }

  return <form action="/auth/reset-password" method="post" onSubmit={submit} aria-busy={pending} className="auth-form">
    <input type="hidden" name="token_hash" value={token} />
    <AuthInput label="Nueva contraseña" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={12} revealable />
    <p className="auth-help">Usá entre 6 y 12 caracteres.</p>
    <AuthInput label="Repetir contraseña" name="repeatPassword" type="password" autoComplete="new-password" minLength={6} maxLength={12} revealable />
    <AuthNotice state={{ status: 'error', message: error }} />
    <button type="submit" className="auth-button" disabled={pending}>{pending ? 'Guardando…' : 'Guardar contraseña'}<ArrowRight size={16} aria-hidden="true" /></button>
  </form>
}
