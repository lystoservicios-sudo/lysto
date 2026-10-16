'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { RegistrationAccess, RegistrationAccessBrand, RegistrationPassword } from './registration-access'
import styles from './registration-access.module.css'

/** New invitations already have an account. Password creation is legacy-only. */
export function InvitationEntry({ token }: { token?: string }) {
  const [legacy, setLegacy] = useState(false)
  if (token && !/^[A-Za-z0-9_-]{43}$/.test(token)) return <section className={styles.access}>
    <RegistrationAccessBrand />
    <div className={styles.intro}>
      <h1>Este enlace no es válido</h1>
      <p>Revisá el enlace del correo de Lysto. Si ya tenés una cuenta, podés retomar el registro con tu acceso.</p>
    </div>
    <Link className={styles.primary} href="/equipo/login?next=%2Fpro%2Fonboarding">Retomar con mi cuenta</Link>
    <Link className={styles.help} href="/contacto">Necesito ayuda</Link>
  </section>

  if (legacy && token) return <LegacyInvitation key={token} token={token} onBack={() => setLegacy(false)} />

  return <RegistrationAccess key={token ?? 'resume'} token={token} onLegacy={token ? () => setLegacy(true) : undefined} />
}

function LegacyInvitation({ token, onBack }: { token: string; onBack: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [existingPassword, setExistingPassword] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    mounted.current = true
    heading.current?.focus()
    return () => { mounted.current = false }
  }, [])

  async function continueRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const values = new FormData(event.currentTarget)
      await privateRequest('/api/professional/onboarding/register', 'POST', {
        token, password: values.get('password'), existingPassword
      })
      if (!mounted.current) return
      router.replace('/pro/onboarding')
      router.refresh()
    } catch (failure) {
      if (mounted.current) setError(requestError(failure))
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return <section className={styles.access}>
    <RegistrationAccessBrand />
    <button type="button" className={styles.back} disabled={busy} onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Volver al acceso</button>
    <div className={styles.intro}>
      <p className={styles.eyebrow}>Invitación anterior</p>
      <h1 ref={heading} tabIndex={-1}>Creá tu contraseña</h1>
      <p>Solo si recibiste una invitación anterior sin clave provisoria. Usá entre 8 y 12 caracteres para aceptar esa invitación.</p>
    </div>
    <form onSubmit={(event) => void continueRegistration(event)} className={styles.form} aria-busy={busy}>
      <fieldset disabled={busy}>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={existingPassword} onChange={(event) => setExistingPassword(event.target.checked)} />
          <span>Ya había creado una contraseña con una invitación anterior</span>
        </label>
        <RegistrationPassword label="Contraseña" autoComplete={existingPassword ? 'current-password' : 'new-password'} minLength={existingPassword ? 1 : 8} maxLength={existingPassword ? 128 : 12} disabled={busy} />
        {existingPassword && <p className={styles.note}>Usá la contraseña que ya tenías. Si nunca la creaste, desmarcá esta opción y elegí una de 8 a 12 caracteres.</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button className={styles.primary} type="submit">{busy ? 'Continuando…' : 'Continuar'}</button>
      </fieldset>
    </form>
    <p className={styles.savedHint}>Después podrás completar tus datos, disponibilidad y documentos. Cada paso guardado queda disponible para retomarlo.</p>
    <Link className={styles.help} href="/contacto">Necesito ayuda</Link>
  </section>
}
