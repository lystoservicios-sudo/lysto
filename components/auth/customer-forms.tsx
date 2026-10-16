'use client'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { ArrowRight, MailCheck } from 'lucide-react'
import { recoverPasswordAction, resendConfirmationAction } from '@/app/(auth)/actions'
import { completeProfileAction } from '@/app/(auth)/completar-perfil/actions'
import type { CustomerField } from '@/lib/auth/customer-access'
import { ArgentineAddressFields, type AddressFieldValue } from '@/components/location/argentine-address-fields'
import { AuthInput, AuthNotice, initialAuthState } from './auth-fields'
export function EmailHelpForm({ mode, next = '/app', email = '' }: { mode: 'confirmation' | 'recovery'; next?: string; email?: string }) {
  const [attempt, setAttempt] = useState(0)
  return <EmailHelpAttempt key={attempt} mode={mode} next={next} email={email} onRetry={() => setAttempt(current => current + 1)} />
}
function EmailHelpAttempt({ mode, next, email, onRetry }: { mode: 'confirmation' | 'recovery'; next: string; email: string; onRetry: () => void }) {
  const [state, action, pending] = useActionState(mode === 'recovery' ? recoverPasswordAction : resendConfirmationAction, { ...initialAuthState, email })
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (state.status === 'success') heading.current?.focus() }, [state.status])
  if (state.status === 'success') return <section className="auth-confirmation">
    <span className="auth-confirmation-icon"><MailCheck aria-hidden="true" /></span>
    <h2 tabIndex={-1} ref={heading}>Revisá tu correo</h2>
    <AuthNotice state={state} />
    <p>Si no encontrás el mensaje, revisá también la carpeta de spam.</p>
    <Link href={`/login?next=${encodeURIComponent(next)}`} className="auth-button">Volver a iniciar sesión<ArrowRight size={16} aria-hidden="true" /></Link>
    <button type="button" className="auth-back" onClick={onRetry}>Usar otro email</button>
  </section>
  return <form action={action} className="auth-form" aria-busy={pending}><input type="hidden" name="next" value={next} /><AuthInput label="Email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" maxLength={254} defaultValue={state.email} disabled={pending} /><AuthNotice state={state} /><button className="auth-button" type="submit" disabled={pending}>{pending ? 'Enviando…' : mode === 'recovery' ? 'Enviar enlace' : 'Reenviar confirmación'}<ArrowRight size={16} aria-hidden="true" /></button>{mode === 'recovery' && <p className="auth-form-bottom"><Link href="/login" className="auth-link">Volver a iniciar sesión</Link></p>}</form>
}
const fieldDetails: Record<Exclude<CustomerField, 'property_type'>, { label: string; autoComplete: string; placeholder: string; type?: string }> = {
  first_name: { label: 'Nombre', autoComplete: 'given-name', placeholder: 'Tu nombre' }, last_name: { label: 'Apellido', autoComplete: 'family-name', placeholder: 'Tu apellido' }, phone: { label: 'Teléfono', autoComplete: 'tel', placeholder: '+54 9 11 1234 5678', type: 'tel' },
  street: { label: 'Calle', autoComplete: 'address-line1', placeholder: 'Nombre de la calle' }, number: { label: 'Altura', autoComplete: 'address-line2', placeholder: 'Número' }, city: { label: 'Localidad', autoComplete: 'address-level2', placeholder: 'Tu localidad' }, province: { label: 'Provincia', autoComplete: 'address-level1', placeholder: 'Tu provincia' }
}
export function CompleteProfileForm({ missing, next, address = null }: { missing: CustomerField[]; next: string; address?: AddressFieldValue | null }) {
  const [state, action, pending] = useActionState(completeProfileAction, initialAuthState)
  const [location, setLocation] = useState<AddressFieldValue>(address ?? { street: '', number: '', city: '', province: '' })
  const [locationProof, setLocationProof] = useState('')
  const geographic = new Set<CustomerField>(['street', 'number', 'city', 'province'])
  const needsLocation = missing.some((key) => geographic.has(key))
  return <form action={action} className="auth-form"><input type="hidden" name="next" value={next} />
    {missing.filter((key) => key !== 'property_type' && !geographic.has(key)).map((key) => <AuthInput key={key} name={key} {...fieldDetails[key as Exclude<CustomerField, 'property_type'>]} disabled={pending} />)}
    {needsLocation && <>
      <ArgentineAddressFields value={location} onChange={setLocation} onProofChange={setLocationProof}
        labels={{ street: 'Calle', number: 'Altura', city: 'Localidad', province: 'Provincia' }}
        order={['street', 'number', 'city', 'province']}
        placeholders={{ street: fieldDetails.street.placeholder, number: fieldDetails.number.placeholder, city: fieldDetails.city.placeholder, province: fieldDetails.province.placeholder }}
        names={{ street: 'street', number: 'number', city: 'city', province: 'province' }}
        idPrefix="auth-location" disabled={pending} />
      <input type="hidden" name="location_proof" value={locationProof} />
    </>}
    {missing.includes('property_type') && <div><label htmlFor="auth-property_type">Tipo de propiedad</label><select id="auth-property_type" name="property_type" defaultValue="" required disabled={pending}><option value="" disabled>Elegí una opción</option><option value="house">Casa</option><option value="apartment">Departamento</option><option value="commercial">Local comercial</option><option value="office">Oficina</option></select></div>}
    <AuthNotice state={state} /><button className="auth-button" type="submit" disabled={pending}>{pending ? 'Guardando tus datos…' : 'Guardar y continuar'}<ArrowRight size={16} aria-hidden="true" /></button>
  </form>
}
