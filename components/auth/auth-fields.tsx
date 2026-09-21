'use client'

import { useId, type ReactNode } from 'react'
import type { AuthActionState } from '@/app/(auth)/actions'

export const initialAuthState: AuthActionState = { status: 'idle', email: '', message: '' }
export function AuthNotice({ state }: { state: Pick<AuthActionState, 'status' | 'message'> }) {
  return state.message ? <div role={state.status === 'error' ? 'alert' : 'status'} className={`auth-notice auth-notice-${state.status}`}>{state.message}</div> : null
}
export function AuthInput({ label, name, type = 'text', autoComplete, placeholder, defaultValue, disabled, minLength, maxLength, children }: { label: string; name: string; type?: string; autoComplete?: string; placeholder?: string; defaultValue?: string; disabled?: boolean; minLength?: number; maxLength?: number; children?: ReactNode }) {
  const id = useId()
  return <div><div className="auth-password-heading"><label htmlFor={id}>{label}</label>{children}</div><input id={id} name={name} type={type} autoComplete={autoComplete} placeholder={placeholder} defaultValue={defaultValue} disabled={disabled} minLength={minLength} maxLength={maxLength} required /></div>
}
