'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import type { AuthActionState } from '@/app/(auth)/actions'

export const initialAuthState: AuthActionState = { status: 'idle', email: '', message: '' }
export function AuthNotice({ state }: { state: Pick<AuthActionState, 'status' | 'message'> }) {
  return state.message ? <div role={state.status === 'error' ? 'alert' : 'status'} className={`auth-notice auth-notice-${state.status}`}>{state.message}</div> : null
}
export function AuthInput({ label, name, type = 'text', autoComplete, placeholder, defaultValue, disabled, minLength, maxLength, revealable = false, children }: { label: string; name: string; type?: string; autoComplete?: string; placeholder?: string; defaultValue?: string; disabled?: boolean; minLength?: number; maxLength?: number; revealable?: boolean; children?: ReactNode }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const canReveal = revealable && type === 'password'
  const accessibleLabel = `${visible ? 'Ocultar' : 'Mostrar'} ${label.toLocaleLowerCase('es')}`

  return <div>
    <div className="auth-password-heading"><label htmlFor={id}>{label}</label>{children}</div>
    <div className={canReveal ? 'auth-password-control' : undefined}>
      <input id={id} name={name} type={canReveal && visible ? 'text' : type} autoComplete={autoComplete} placeholder={placeholder} defaultValue={defaultValue} disabled={disabled} minLength={minLength} maxLength={maxLength} required />
      {canReveal && <button type="button" className="auth-password-toggle" aria-label={accessibleLabel} aria-pressed={visible} disabled={disabled} onClick={() => setVisible(current => !current)}>
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>}
    </div>
  </div>
}
