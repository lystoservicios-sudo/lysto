'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { ArrowRight } from 'lucide-react'
import { AuthInput, AuthNotice, GoogleButton } from '@/components/auth/auth-fields'
import { loginAction, type LoginActionState } from './actions'
import { loginAction as staffLoginAction } from '../equipo/login/actions'
const initialLoginState: LoginActionState = { status: 'idle', email: '', message: '' }
export type LoginFormViewProps = { state: LoginActionState; pending: boolean; formAction: (payload: FormData) => void; next?: string; staff?: boolean }
export function LoginFormView({ state, pending, formAction, next = '/app', staff = false }: LoginFormViewProps) {
  return <form action={formAction} className="auth-form">
    <input type="hidden" name="next" value={next} />
    <AuthInput label="Email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" defaultValue={state.email} disabled={pending} />
    <AuthInput label="Contraseña" name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" disabled={pending}><Link href="/recuperar-contrasena" className="auth-link">¿La olvidaste?</Link></AuthInput>
    <AuthNotice state={state} />
    <button type="submit" className="auth-button" disabled={pending}>{pending ? 'Ingresando…' : 'Ingresar'}<ArrowRight size={16} aria-hidden="true" /></button>
    {!staff && <p className="auth-form-bottom">¿Todavía no tenés cuenta? <Link className="auth-link" href={next === '/app' ? '/registro' : `/registro?next=${encodeURIComponent(next)}`}>Crear cuenta</Link></p>}
  </form>
}
export function LoginForm({ next = '/app', staff = false }: { next?: string; staff?: boolean }) {
  const [state, formAction, pending] = useActionState(staff ? staffLoginAction : loginAction, initialLoginState)
  return <>{!staff && <><GoogleButton next={next} /><div className="auth-divider">o ingresá con tu email</div></>}<LoginFormView state={state} pending={pending} formAction={formAction} next={next} staff={staff} /></>
}
