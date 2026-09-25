'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { privateRequest, requestError } from '@/lib/http/private-client'

export function InvitationEntry({ token }: { token?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [existingPassword, setExistingPassword] = useState(false)
  useEffect(() => setBusy(false), [])

  async function continueRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || busy) return
    setBusy(true)
    setError('')
    try {
      const values = new FormData(event.currentTarget)
      await privateRequest('/api/professional/onboarding/register', 'POST', {
        token, password: values.get('password'), existingPassword
      })
      router.replace('/pro/onboarding')
      router.refresh()
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }

  if (!token) return <section className="space-y-4 rounded-2xl border bg-white p-6">
    <h1 className="text-2xl font-bold">Continuar mi registro profesional</h1>
    <p>Ingresá con tu correo y contraseña para retomar el paso donde quedaste.</p>
    <Link className="inline-block rounded bg-blue-700 px-4 py-3 font-semibold text-white" href="/equipo/login?next=%2Fpro%2Fonboarding">Iniciar sesión</Link>
    <p>Si no llegaste a crear una contraseña, pedí a administración una nueva invitación.</p>
  </section>

  return <section className="space-y-5 rounded-2xl border bg-white p-6">
    <p className="text-sm font-semibold text-blue-700">Invitación profesional · paso 1</p>
    <h1 className="text-2xl font-bold">Creá tu contraseña</h1>
    <p>Usá entre 8 y 12 caracteres. Al continuar aceptás la invitación y empezás a completar tu perfil.</p>
    <form onSubmit={(event) => void continueRegistration(event)} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <label className="block">
          <input type="checkbox" checked={existingPassword}
            onChange={(event) => setExistingPassword(event.target.checked)} />{' '}
          Ya había creado una contraseña con una invitación anterior
        </label>
        <label className="block">Contraseña
          <input className="block w-full rounded border p-3" name="password" type="password"
            autoComplete={existingPassword ? 'current-password' : 'new-password'}
            minLength={existingPassword ? 1 : 8} maxLength={existingPassword ? 128 : 12} required />
        </label>
        {existingPassword && <p>Usá la contraseña que ya tenías. Si nunca la creaste, desmarcá esta opción y elegí una de 8 a 12 caracteres.</p>}
        <button className="rounded bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
          type="submit">Continuar</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="text-red-800">{error}</p>}
  </section>
}
