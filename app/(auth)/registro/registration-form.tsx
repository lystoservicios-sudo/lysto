'use client'
import { useActionState } from 'react'
import { AuthInput, AuthNotice } from '@/components/auth/auth-fields'
import type { AccountResult, RegistrationPolicy } from '@/lib/auth/account-lifecycle'
import { registerAction } from './actions'
import { completeAccountAction } from '../completar-cuenta/actions'

const initial: AccountResult = { status: 'idle', message: '' }
export function RegistrationForm({ policy, completing = false, next = '/app', initialValues = {} }: { policy: RegistrationPolicy; completing?: boolean; next?: string; initialValues?: { firstName?: string; lastName?: string; phone?: string } }) {
  const [state, action, pending] = useActionState(completing ? completeAccountAction : registerAction, initial)
  return <form action={action} className="auth-form">
    {policy.testOnly && <p className="auth-notice">Entorno de ensayo: estos documentos no habilitan operaciones reales.</p>}
    <input type="hidden" name="next" value={next} />
    <div className="auth-two-fields"><AuthInput label="Nombre" name="firstName" autoComplete="given-name" maxLength={100} disabled={pending} defaultValue={initialValues.firstName} /><AuthInput label="Apellido" name="lastName" autoComplete="family-name" maxLength={100} disabled={pending} defaultValue={initialValues.lastName} /></div>
    {!completing && <AuthInput label="Email" name="email" type="email" autoComplete="email" maxLength={254} disabled={pending} />}
    <AuthInput label="Teléfono" name="phone" type="tel" autoComplete="tel" maxLength={40} disabled={pending} defaultValue={initialValues.phone} />
    {!completing && <><AuthInput label="Contraseña" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={12} revealable disabled={pending} /><p className="auth-help">Usá entre 6 y 12 caracteres.</p><AuthInput label="Repetir contraseña" name="repeatPassword" type="password" autoComplete="new-password" minLength={6} maxLength={12} revealable disabled={pending} /></>}
    <input type="hidden" name="termsVersion" value={policy.termsVersion} />
    <input type="hidden" name="privacyVersion" value={policy.privacyVersion} />
    <label className="auth-consent"><input name="accepted" type="checkbox" required disabled={pending} className="mt-1 h-5 w-5 shrink-0" /><span>Leí y acepto los <a className="auth-link" href={policy.termsUrl} target="_blank" rel="noopener noreferrer">términos ({policy.termsVersion})</a> y la <a className="auth-link" href={policy.privacyUrl} target="_blank" rel="noopener noreferrer">política de privacidad ({policy.privacyVersion})</a>.</span></label>
    <AuthNotice state={state} /><button type="submit" disabled={pending} className="auth-button">{pending ? 'Procesando…' : completing ? 'Guardar y continuar' : 'Crear mi cuenta'}</button>
  </form>
}
