'use client'

import { useActionState, useId, type ReactNode } from 'react'
import { googleAuthAction, type AuthActionState } from '@/app/(auth)/actions'

export const initialAuthState: AuthActionState = { status: 'idle', email: '', message: '' }
export function AuthNotice({ state }: { state: Pick<AuthActionState, 'status' | 'message'> }) {
  return state.message ? <div role={state.status === 'error' ? 'alert' : 'status'} className={`auth-notice auth-notice-${state.status}`}>{state.message}</div> : null
}
export function AuthInput({ label, name, type = 'text', autoComplete, placeholder, defaultValue, disabled, minLength, maxLength, children }: { label: string; name: string; type?: string; autoComplete?: string; placeholder?: string; defaultValue?: string; disabled?: boolean; minLength?: number; maxLength?: number; children?: ReactNode }) {
  const id = useId()
  return <div><div className="auth-password-heading"><label htmlFor={id}>{label}</label>{children}</div><input id={id} name={name} type={type} autoComplete={autoComplete} placeholder={placeholder} defaultValue={defaultValue} disabled={disabled} minLength={minLength} maxLength={maxLength} required /></div>
}
export function GoogleButton({ next = '/app' }: { next?: string }) {
  const [state, action, pending] = useActionState(googleAuthAction, initialAuthState)
  return <><form action={action}><input type="hidden" name="next" value={next} /><button className="auth-button auth-google" disabled={pending} type="submit"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285f4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11c-.5 2.4-1.9 4.4-4 5.8v4.8h6.5c3.8-3.5 6.1-8.4 6.1-14.2Z"/><path fill="#34a853" d="M24 44c5.4 0 9.9-1.8 13.3-4.9l-6.5-4.8c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.3H6.1v5C9.5 39.5 16.2 44 24 44Z"/><path fill="#fbbc05" d="M12.8 27.9a12 12 0 0 1 0-7.8v-5H6.1a20 20 0 0 0 0 17.8l6.7-5Z"/><path fill="#ea4335" d="M24 11.8c2.9 0 5.5 1 7.5 2.9l5.7-5.7A19.2 19.2 0 0 0 24 4C16.2 4 9.5 8.5 6.1 15.1l6.7 5C14.4 15.3 18.8 11.8 24 11.8Z"/></svg>{pending ? 'Conectando…' : 'Continuar con Google'}</button></form><AuthNotice state={state} /></>
}
