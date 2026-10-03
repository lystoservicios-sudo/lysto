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

  if (!token) return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-9">
    <p className="text-sm font-semibold text-blue-700">Tu espacio de trabajo</p>
    <h1 className="mt-2 text-3xl font-black tracking-tight">Continuá tu registro profesional</h1>
    <p className="mt-3 max-w-2xl leading-7 text-slate-600">Ingresá con tu correo y contraseña para retomar el paso donde quedaste. Los pasos que guardaste quedan disponibles para retomarlos.</p>
    <Link className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-lysto-blueDark px-5 font-semibold text-white shadow-soft transition hover:bg-blue-800" href="/equipo/login?next=%2Fpro%2Fonboarding">Iniciar sesión</Link>
    <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">Si todavía no creaste una contraseña, pedí a administración que te envíe una nueva invitación.</p>
  </section>

  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
    <div className="border-b border-slate-100 bg-blue-50/70 px-6 py-7 sm:px-9">
      <p className="text-sm font-semibold text-blue-700">Invitación profesional <span className="px-1 text-blue-300">/</span> Paso 1 de 6</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">Creá tu contraseña</h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">Usá entre 8 y 12 caracteres. Al continuar aceptás la invitación y empezás a completar tu perfil.</p>
    </div>
    <form onSubmit={(event) => void continueRegistration(event)} className="space-y-5 p-6 sm:p-9">
      <fieldset disabled={busy} className="max-w-xl space-y-5">
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6">
          <input className="mt-1 accent-blue-700" type="checkbox" checked={existingPassword}
            onChange={(event) => setExistingPassword(event.target.checked)} />{' '}
          <span>Ya había creado una contraseña con una invitación anterior</span>
        </label>
        <label className="block space-y-2 text-sm font-semibold text-slate-800">Contraseña
          <input className="block min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100" name="password" type="password"
            autoComplete={existingPassword ? 'current-password' : 'new-password'}
            minLength={existingPassword ? 1 : 8} maxLength={existingPassword ? 128 : 12} required />
        </label>
        {existingPassword && <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900">Usá la contraseña que ya tenías. Si nunca la creaste, desmarcá esta opción y elegí una de 8 a 12 caracteres.</p>}
        <button className="inline-flex min-h-12 items-center rounded-2xl bg-lysto-blueDark px-5 font-semibold text-white shadow-soft transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit">Continuar</button>
      </fieldset>
      <p className="max-w-xl border-t border-slate-100 pt-4 text-sm leading-6 text-slate-500">Después vas a poder completar tus datos, disponibilidad, herramientas y documentación. Podés salir y retomar más tarde con tu correo y esta contraseña.</p>
    </form>
    {error && <p role="alert" className="mx-6 mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:mx-9">{error}</p>}
  </section>
}
