'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { privateRequest, requestError } from '@/lib/http/private-client'

export function InvitationEntry({ token }: { token?: string }) {
  const router = useRouter()
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(true)
  // Do not accept edits before hydration installs the change handlers.
  useEffect(() => {
    setBusy(false)
  }, [])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const values = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await privateRequest<{ message: string }>(
        '/api/professional/onboarding/' + (register ? 'register' : 'login'),
        'POST',
        {
          token,
          email: values.get('email'),
          password: values.get('password'),
          ...(register ? { repeatPassword: values.get('repeatPassword') } : {})
        }
      )
      setMessage(result.message)
      if (!register && !token) {
        router.refresh()
      }
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function accept() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await privateRequest('/api/professional/onboarding/accept', 'POST', { token })
      router.replace('/pro/onboarding')
      router.refresh()
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-5 rounded-2xl border bg-white p-6">
      <h1 className="text-2xl font-bold">
        {token ? 'Tu invitación profesional' : 'Tu postulación profesional'}
      </h1>
      <p>
        Ingresá con el correo que recibió la invitación. Si todavía no tenés cuenta, registrate y
        confirmá tu correo antes de volver a este enlace.
      </p>
      <form onSubmit={authenticate} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <legend className="font-semibold">
            {register ? 'Crear cuenta para postularme' : 'Iniciar sesión'}
          </legend>
          <label className="block">
            Correo invitado
            <input
              className="block w-full rounded border p-3"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label className="block">
            Contraseña
            <input
              className="block w-full rounded border p-3"
              name="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={register ? 12 : 1}
              maxLength={128}
              required
            />
          </label>
          {register && (
            <label className="block">
              Repetir contraseña
              <input
                className="block w-full rounded border p-3"
                name="repeatPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
          )}
          <button className="rounded bg-blue-700 px-4 py-3 font-semibold text-white" type="submit">
            {register ? 'Registrarme' : 'Ingresar'}
          </button>
          {token && (
            <button
              className="ml-3 underline"
              type="button"
              onClick={() => {
                setRegister(!register)
                setError('')
                setMessage('')
              }}
            >
              {register ? 'Ya tengo cuenta' : 'Crear cuenta'}
            </button>
          )}
        </fieldset>
      </form>
      <p>
        Con la sesión iniciada y el correo confirmado, aceptá la invitación para abrir tu
        postulación. La habilitación para trabajar requiere revisión posterior.
      </p>
      {token ? (
        <button
          disabled={busy}
          onClick={accept}
          className="rounded bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          Aceptar invitación
        </button>
      ) : (
        <p>
          Si confirmaste tu correo y todavía no aceptaste la invitación, abrí de nuevo el enlace del
          mensaje original.
        </p>
      )}
      <p>
        <Link className="underline" href="/pro/onboarding">
          Ya acepté: continuar mi postulación
        </Link>
      </p>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
    </section>
  )
}
