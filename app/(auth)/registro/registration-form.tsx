'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import type { AccountResult, RegistrationPolicy } from '@/lib/auth/account-lifecycle'
import { registerAction } from './actions'
import { completeAccountAction } from '../completar-cuenta/actions'

const initial: AccountResult = { status: 'idle', message: '' }
export function RegistrationForm({ policy, completing = false }: { policy: RegistrationPolicy; completing?: boolean }) {
  const [state, action, pending] = useActionState(completing ? completeAccountAction : registerAction, initial)
  return <form action={action} className="mt-6 space-y-4">
    {policy.testOnly && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Entorno de ensayo: estos documentos no habilitan operaciones reales.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-semibold">Nombre<Input name="firstName" autoComplete="given-name" required maxLength={100} disabled={pending} /></label>
      <label className="space-y-2 text-sm font-semibold">Apellido<Input name="lastName" autoComplete="family-name" required maxLength={100} disabled={pending} /></label>
      {!completing && <label className="space-y-2 text-sm font-semibold">Email<Input name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} /></label>}
      <label className="space-y-2 text-sm font-semibold">Teléfono<Input name="phone" type="tel" autoComplete="tel" required minLength={6} maxLength={40} disabled={pending} /></label>
      {!completing && <><label className="space-y-2 text-sm font-semibold">Contraseña<Input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending} /><span className="text-xs text-slate-500">De 12 a 128 caracteres.</span></label>
      <label className="space-y-2 text-sm font-semibold">Repetir contraseña<Input name="repeatPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending} /></label></>}
    </div>
    <input type="hidden" name="termsVersion" value={policy.termsVersion} />
    <input type="hidden" name="privacyVersion" value={policy.privacyVersion} />
    <label className="flex items-start gap-3 text-sm leading-6"><input name="accepted" type="checkbox" required disabled={pending} className="mt-1 h-5 w-5" /><span>Leí y acepto los <a className="font-bold text-blue-700 underline" href={policy.termsUrl} target="_blank" rel="noopener noreferrer">términos ({policy.termsVersion})</a> y la <a className="font-bold text-blue-700 underline" href={policy.privacyUrl} target="_blank" rel="noopener noreferrer">política de privacidad ({policy.privacyVersion})</a>.</span></label>
    {state.message && <p role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite" className="rounded-xl bg-slate-50 p-4 text-sm leading-6">{state.message}</p>}
    <button type="submit" disabled={pending} className="h-12 rounded-xl bg-blue-700 px-6 font-bold text-white disabled:opacity-60">{pending ? 'Procesando…' : completing ? 'Completar cuenta' : 'Crear cuenta'}</button>
  </form>
}
