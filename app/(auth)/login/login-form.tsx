'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { LockKeyhole, ShieldCheck } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  initialLoginState,
  loginAction,
  type LoginActionState
} from './actions'

export type LoginFormViewProps = {
  state: LoginActionState
  pending: boolean
  formAction: (payload: FormData) => void
}

export function LoginFormView({ state, pending, formAction }: LoginFormViewProps) {
  return (
    <form action={formAction} className="mt-7 space-y-5" noValidate={false}>
      <div className="space-y-2">
        <label htmlFor="login-email" className="block text-sm font-bold text-slate-800">
          Email
        </label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.email}
          placeholder="tu@email.com"
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="login-password" className="block text-sm font-bold text-slate-800">
          Contraseña
        </label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Ingresá tu contraseña"
          required
          disabled={pending}
        />
      </div>

      {state.status === 'error' ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800"
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lysto-blue px-5 text-base font-bold text-white shadow-sm transition hover:bg-lysto-blueDark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-wait disabled:opacity-70"
      >
        <LockKeyhole aria-hidden="true" className="h-5 w-5" />
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>

      <Link
        href="/registro"
        className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
      >
        Crear cuenta cliente
      </Link>

      <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-slate-600 lg:hidden">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600" />
        Acceso seguro para clientes, técnicos y administración.
      </p>
    </form>
  )
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginState)
  return <LoginFormView state={state} pending={pending} formAction={formAction} />
}
