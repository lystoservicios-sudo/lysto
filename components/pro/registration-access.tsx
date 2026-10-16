'use client'

import Link from 'next/link'
import { useActionState, useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { Brand } from '@/components/marketing/brand'
import { loginAction, type LoginActionState } from '@/app/(auth)/equipo/login/actions'
import styles from './registration-access.module.css'

const initial: LoginActionState = { status: 'idle', email: '', message: '' }

export function RegistrationRetry() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button type="button" className={styles.textButton} disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? 'Cargando…' : 'Volver a intentar'}</button>
}

export function RegistrationRestrictedState({ status }: { status: 'suspended' | 'inactive' }) {
  return <section className={styles.access}>
    <RegistrationAccessBrand />
    <div className={styles.intro}>
      <h1>{status === 'suspended' ? 'Tu cuenta está suspendida' : 'Tu cuenta está inactiva'}</h1>
      <p>{status === 'suspended' ? 'Contactá a Lysto para conocer los próximos pasos.' : 'Si querés retomar tu actividad, contactá a Lysto.'}</p>
    </div>
    <p className={styles.note} role="status">No podés recibir trabajos ni modificar tu postulación en este estado.</p>
    <div className={styles.actions}>
      <RegistrationRetry />
      <Link className={styles.help} href="/contacto">Necesito ayuda</Link>
    </div>
  </section>
}

export function RegistrationAccessBrand() {
  return <header className={styles.brandHeader}>
    <Link href="/" className={styles.brand} aria-label="Lysto, volver al inicio"><Brand /></Link>
    <span>App Técnico</span>
  </header>
}

export function RegistrationPassword({ label, autoComplete = 'current-password', minLength, maxLength = 128, disabled = false }: {
  label: string; autoComplete?: string; minLength?: number; maxLength?: number; disabled?: boolean
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.password}>
      <input id={id} name="password" type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} maxLength={maxLength} disabled={disabled} required />
      <button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} disabled={disabled} onClick={() => setVisible((value) => !value)}>
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  </div>
}

export function RegistrationAccess({ token, onLegacy }: { token?: string; onLegacy?: () => void }) {
  const [state, formAction, pending] = useActionState(loginAction, initial)
  const emailId = useId()
  const next = token ? `/pro/onboarding/${token}` : '/pro/onboarding'

  return <section className={styles.access}>
    <RegistrationAccessBrand />
    <div className={styles.intro}>
      <h1>{token ? 'Ingresá para comenzar' : 'Retomá tu registro'}</h1>
      <p className={styles.eyebrow}>Invitación de Lysto</p>
      <p>Usá el correo y la clave provisoria que recibiste por email. Si ya la cambiaste, ingresá con tu contraseña actual.</p>
    </div>
    <form action={formAction} className={styles.form} aria-busy={pending}>
      <input name="next" type="hidden" value={next} />
      <div className={styles.field}>
        <label htmlFor={emailId}>Correo electrónico</label>
        <input id={emailId} name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} defaultValue={state.email} maxLength={254} required disabled={pending} />
      </div>
      <RegistrationPassword label="Contraseña provisoria o actual" disabled={pending} />
      {state.message && <p className={styles.error} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>{pending ? 'Ingresando…' : 'Ingresar y continuar'}</button>
        <p className={styles.savedHint}>Tu avance se guarda al continuar cada paso.</p>
        <Link className={styles.help} href="/contacto">Necesito ayuda</Link>
      </div>
    </form>
    {onLegacy && <details className={styles.legacy}>
      <summary>¿Tu invitación no incluía una clave provisoria?</summary>
      <p>Las invitaciones anteriores permiten crear una contraseña desde el enlace recibido.</p>
      <button type="button" className={styles.textButton} onClick={onLegacy} disabled={pending}>Tengo una invitación anterior sin clave provisoria</button>
    </details>}
  </section>
}
