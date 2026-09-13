'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { ArrowRight } from 'lucide-react'
import { registerAction, recoverPasswordAction, resendConfirmationAction, updatePasswordAction } from '@/app/(auth)/actions'
import { completeProfileAction } from '@/app/(auth)/completar-perfil/actions'
import type { CustomerField } from '@/lib/auth/customer-access'
import { AuthInput, AuthNotice, GoogleButton, initialAuthState } from './auth-fields'
export function RegistrationForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(registerAction, initialAuthState)
  if (state.status === 'success') return <><AuthNotice state={state} /><p className="auth-form-bottom"><Link href={`/login?next=${encodeURIComponent(next)}`} className="auth-link">Ya confirmé mi email. Ingresar</Link></p><details className="auth-resend"><summary>Reenviar email de confirmación</summary><EmailHelpForm mode="confirmation" next={next} email={state.email} /></details></>
  return <><GoogleButton next={next} /><div className="auth-divider">o creá tu cuenta con email</div><form action={action} className="auth-form">
    <input type="hidden" name="next" value={next} />
    <div className="auth-two-fields"><AuthInput label="Nombre" name="firstName" autoComplete="given-name" placeholder="Tu nombre" disabled={pending} maxLength={100} /><AuthInput label="Apellido" name="lastName" autoComplete="family-name" placeholder="Tu apellido" disabled={pending} maxLength={100} /></div>
    <AuthInput label="Email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" defaultValue={state.email} disabled={pending} />
    <div><AuthInput label="Contraseña" name="password" type="password" autoComplete="new-password" placeholder="Creá una contraseña" minLength={10} maxLength={128} disabled={pending} /><p className="auth-help">Al menos 10 caracteres. Combiná palabras, números o símbolos.</p></div>
    <AuthInput label="Repetir contraseña" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Repetí tu contraseña" minLength={10} maxLength={128} disabled={pending} />
    <AuthNotice state={state} /><button type="submit" className="auth-button" disabled={pending}>{pending ? 'Creando tu cuenta…' : 'Crear mi cuenta'}<ArrowRight size={16} aria-hidden="true" /></button>
    <p className="auth-form-bottom">¿Ya tenés cuenta? <Link className="auth-link" href={`/login?next=${encodeURIComponent(next)}`}>Iniciar sesión</Link></p>
  </form></>
}
export function EmailHelpForm({ mode, next = '/app', email = '' }: { mode: 'confirmation' | 'recovery'; next?: string; email?: string }) {
  const [state, action, pending] = useActionState(mode === 'recovery' ? recoverPasswordAction : resendConfirmationAction, { ...initialAuthState, email })
  return <form action={action} className="auth-form"><input type="hidden" name="next" value={next} /><AuthInput label="Email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" defaultValue={state.email} disabled={pending} /><AuthNotice state={state} /><button className="auth-button" type="submit" disabled={pending}>{pending ? 'Enviando…' : mode === 'recovery' ? 'Enviar enlace' : 'Reenviar confirmación'}</button>{mode === 'recovery' && <p className="auth-form-bottom"><Link href="/login" className="auth-link">Volver a iniciar sesión</Link></p>}</form>
}
export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initialAuthState)
  return <form action={action} className="auth-form"><AuthInput label="Nueva contraseña" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} disabled={pending} /><p className="auth-help">Usá al menos 10 caracteres.</p><AuthInput label="Repetir contraseña" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} disabled={pending} /><AuthNotice state={state} /><button className="auth-button" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar nueva contraseña'}</button><p className="auth-form-bottom"><Link href="/recuperar-contrasena" className="auth-link">Pedir un nuevo enlace</Link></p></form>
}
const fieldDetails: Record<Exclude<CustomerField, 'property_type'>, { label: string; autoComplete: string; placeholder: string; type?: string }> = {
  first_name: { label: 'Nombre', autoComplete: 'given-name', placeholder: 'Tu nombre' }, last_name: { label: 'Apellido', autoComplete: 'family-name', placeholder: 'Tu apellido' }, phone: { label: 'Teléfono', autoComplete: 'tel', placeholder: '+54 9 11 1234 5678', type: 'tel' },
  street: { label: 'Calle', autoComplete: 'address-line1', placeholder: 'Nombre de la calle' }, number: { label: 'Altura', autoComplete: 'address-line2', placeholder: 'Número' }, city: { label: 'Localidad', autoComplete: 'address-level2', placeholder: 'Tu localidad' }, province: { label: 'Provincia', autoComplete: 'address-level1', placeholder: 'Tu provincia' }
}
export function CompleteProfileForm({ missing, next }: { missing: CustomerField[]; next: string }) {
  const [state, action, pending] = useActionState(completeProfileAction, initialAuthState)
  return <form action={action} className="auth-form"><input type="hidden" name="next" value={next} />
    {missing.filter((key) => key !== 'property_type').map((key) => <AuthInput key={key} name={key} {...fieldDetails[key as Exclude<CustomerField, 'property_type'>]} disabled={pending} />)}
    {missing.includes('property_type') && <div><label htmlFor="auth-property_type">Tipo de propiedad</label><select id="auth-property_type" name="property_type" defaultValue="" required disabled={pending}><option value="" disabled>Elegí una opción</option><option value="house">Casa</option><option value="apartment">Departamento</option><option value="commercial">Local comercial</option><option value="office">Oficina</option></select></div>}
    <AuthNotice state={state} /><button className="auth-button" type="submit" disabled={pending}>{pending ? 'Guardando tus datos…' : 'Guardar y continuar'}<ArrowRight size={16} aria-hidden="true" /></button>
  </form>
}
