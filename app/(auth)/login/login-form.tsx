'use client'
import Link from 'next/link'
import { useActionState, useSyncExternalStore } from 'react'
import { ArrowRight } from 'lucide-react'
import { AuthInput, AuthNotice } from '@/components/auth/auth-fields'
import { loginAction, type LoginActionState } from './actions'
import { loginAction as staffLoginAction } from '../equipo/login/actions'

const initial: LoginActionState = { status: 'idle', email: '', message: '' }
const subscribeToClientReadiness = () => () => undefined
export type LoginFormViewProps = { state: LoginActionState; pending: boolean; formAction: (payload: FormData) => void; next?: string; staff?: boolean; ready?: boolean }
export function LoginFormView({ state, pending, formAction, next = '/app', staff = false, ready = true }: LoginFormViewProps) {
  const controlsDisabled = pending || !ready
  return <form action={formAction} className="auth-form" aria-busy={controlsDisabled}>
    <input type="hidden" name="next" value={next} />
    <AuthInput label="Email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" defaultValue={state.email} disabled={controlsDisabled} />
    <AuthInput label="Contraseña" name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" revealable disabled={controlsDisabled} />
    <div className="auth-recovery-link"><Link className="auth-link" href="/recuperar">Olvidé mi contraseña</Link></div>
    <AuthNotice state={state} />
    <button type="submit" disabled={controlsDisabled} className="auth-button">{pending ? 'Ingresando…' : 'Ingresar'}<ArrowRight size={16} aria-hidden="true" /></button>
    {!staff && <p className="auth-form-bottom">¿Es tu primera vez? <Link className="auth-link" href={`/registro?next=${encodeURIComponent(next)}`}>Crear una cuenta</Link></p>}
  </form>
}
export function LoginForm({ next = '/app', staff = false }: { next?: string; staff?: boolean }) {
  // Do not accept a click before React can dispatch the server action.
  const ready = useSyncExternalStore(subscribeToClientReadiness, () => true, () => false)
  const [state, formAction, pending] = useActionState(staff ? staffLoginAction : loginAction, initial)
  return <LoginFormView state={state} pending={pending} formAction={formAction} next={next} staff={staff} ready={ready} />
}
