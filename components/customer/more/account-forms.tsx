'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { privateRequest, PrivateRequestError } from '@/lib/http/private-client'
import { passwordSchema } from '@/lib/auth/customer-access'
import type { CustomerAssetProfile } from '@/lib/customer-assets/contracts'
import type { CustomerPreferences } from '@/lib/customer-account/service'
import styles from './more.module.css'
import { useClientFocusedFlow } from '@/components/app-shell/client-flow-context'

function useAction() {
  const [busy, setBusy] = useState(false)
  useClientFocusedFlow(busy)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  async function run(action: () => Promise<void>, success: string) {
    if (busy) return
    setBusy(true); setMessage(''); setError(false)
    try { await action(); setMessage(success) }
    catch (cause) {
      setError(true)
      setMessage(cause instanceof PrivateRequestError ? cause.message : 'No pudimos confirmar la operación. Revisá el estado antes de volver a intentarlo.')
    } finally { setBusy(false) }
  }
  return { busy, message, error, run, clear: () => setMessage('') }
}
function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return action.message ? <p role={action.error ? 'alert' : 'status'} className={action.error ? styles.error : styles.success}>{action.message}</p> : null
}
function accountRequest<T>(path: string, customerId: string, body?: unknown, method = 'POST') {
  return privateRequest<T>(path, method, body, { 'X-Lysto-Customer-Id': customerId })
}

export function CustomerPreferencesForm({ initialValue, customerId }: { initialValue: CustomerPreferences; customerId: string }) {
  const [saved, setSaved] = useState(initialValue), [value, setValue] = useState(initialValue)
  const action = useAction(), router = useRouter()
  const dirty = JSON.stringify(value) !== JSON.stringify(saved)
  const toggle = (key: 'emailMaintenance' | 'emailSupportUpdates' | 'marketingEmail' | 'reduceMotion', label: string, description: string) => <label className={styles.toggle}>
    <span><strong>{label}</strong><small>{description}</small></span>
    <input aria-label={label} type="checkbox" checked={value[key]} disabled={action.busy} onChange={event => { setValue({ ...value, [key]: event.target.checked }); action.clear() }} />
  </label>
  return <form className={styles.form} onSubmit={event => {
    event.preventDefault()
    void action.run(async () => {
      const result = await accountRequest<{ preferences: CustomerPreferences }>('/api/customer/preferences', customerId, value, 'PUT')
      if (!Number.isInteger(result.preferences?.version)) throw new Error('invalid_response')
      setSaved(result.preferences); setValue(result.preferences)
      window.dispatchEvent(new CustomEvent('lysto:preferences', { detail: { reduceMotion: result.preferences.reduceMotion } }))
      router.refresh()
    }, 'Preferencias guardadas.')
  }}>
    <p className={styles.notice}>Los avisos necesarios para tu seguridad, visitas y pagos se mantienen activos. Estas preferencias no cambian el estado de tus servicios.</p>
    <div>
      {toggle('emailSupportUpdates', 'Novedades de mis consultas', 'Recibir por email las novedades no urgentes de soporte. Siempre podés consultarlas dentro de la app.')}
      {toggle('emailMaintenance', 'Recordatorios de mantenimiento', 'Recibir por email recordatorios de cuidado de tus equipos cuando haya uno programado.')}
      {toggle('marketingEmail', 'Novedades y promociones', 'Recibir comunicaciones comerciales de Lysto por email. Opcional y desactivado inicialmente.')}
      {toggle('reduceMotion', 'Reducir movimiento', 'Simplificar las transiciones y el movimiento de la maqueta. También respetamos la configuración de tu dispositivo.')}
    </div>
    <Feedback action={action} />
    <div className={styles.actions}><button className={styles.primary} disabled={!dirty || action.busy} aria-busy={action.busy}>{action.busy ? 'Guardando…' : 'Guardar preferencias'}</button><button className={styles.secondary} disabled={!dirty || action.busy} type="button" onClick={() => { setValue(saved); action.clear() }}>Descartar cambios</button></div>
    {action.error ? <button className={styles.textAction} type="button" disabled={action.busy} onClick={() => window.location.reload()}>Recargar preferencias guardadas</button> : null}
  </form>
}

export function CustomerProfileEditor({ profile, customerId }: { profile: CustomerAssetProfile; customerId: string }) {
  const [saved, setSaved] = useState(profile), [value, setValue] = useState(profile)
  const action = useAction(), router = useRouter()
  const dirty = ['firstName', 'lastName', 'phone'].some(key => value[key as keyof CustomerAssetProfile] !== saved[key as keyof CustomerAssetProfile])
  const valid = value.firstName.trim() && value.lastName.trim() && value.phone.replace(/\D/g, '').length >= 8
  const field = (name: 'firstName' | 'lastName' | 'phone', label: string) => <label className={styles.field}>{label}<input aria-label={label} autoComplete={name === 'firstName' ? 'given-name' : name === 'lastName' ? 'family-name' : 'tel'} type={name === 'phone' ? 'tel' : 'text'} maxLength={name === 'phone' ? 40 : 100} required value={value[name]} disabled={action.busy} onChange={event => { setValue({ ...value, [name]: event.target.value }); action.clear() }} /></label>
  return <form className={styles.form} onSubmit={event => {
    event.preventDefault(); if (!valid || !dirty) return
    void action.run(async () => {
      const result = await accountRequest<{ profile: CustomerAssetProfile }>('/api/customer/profile', customerId, { firstName: value.firstName, lastName: value.lastName, phone: value.phone, notificationPreference: saved.notificationPreference, expectedVersion: saved.version }, 'PUT')
      if (!result.profile || !Number.isInteger(result.profile.version)) throw new Error('invalid_response')
      setSaved(result.profile); setValue(result.profile); router.refresh()
    }, 'Tus datos quedaron guardados.')
  }}>
    {field('firstName', 'Nombre')}{field('lastName', 'Apellido')}{field('phone', 'Teléfono')}
    <div className={styles.field}><span>Correo de la cuenta</span><p className={styles.muted}>{saved.email}</p><Link className={styles.textAction} href="/app/perfil/correo">Cambiar correo</Link></div>
    <Feedback action={action} />
    <div className={styles.actions}><button className={styles.primary} disabled={!dirty || !valid || action.busy}>{action.busy ? 'Guardando…' : 'Guardar cambios'}</button><button className={styles.secondary} type="button" disabled={!dirty || action.busy} onClick={() => { setValue(saved); action.clear() }}>Descartar cambios</button></div>
    {action.error ? <button className={styles.textAction} type="button" onClick={() => window.location.reload()}>Recargar datos guardados</button> : null}
  </form>
}

export function CustomerEmailForm({ email: currentEmail, pendingEmail, customerId }: { email: string; pendingEmail?: string | null; customerId: string }) {
  const [email, setEmail] = useState(''), [requested, setRequested] = useState(pendingEmail ?? '')
  const action = useAction()
  return <form className={styles.form} onSubmit={event => {
    event.preventDefault()
    void action.run(async () => {
      await accountRequest('/api/customer/profile/email', customerId, { email })
      setRequested(email); setEmail('')
    }, 'Si el cambio puede realizarse, recibirás un enlace en el correo actual y otro en el nuevo. Confirmá ambos para completar el cambio.')
  }}>
    <p className={styles.muted}>Correo actual: {currentEmail}</p>
    <p className={styles.notice}>Necesitás acceso al correo actual y al nuevo. Tu correo de ingreso no cambia hasta que confirmes los enlaces.</p>
    {requested ? <p role="status" className={styles.notice}>Solicitud de cambio a {requested}. Si aún no confirmaste ambos enlaces, el cambio sigue pendiente de verificación.</p> : null}
    <label className={styles.field}>Nuevo correo<input type="email" required autoComplete="email" maxLength={254} value={email} disabled={action.busy} onChange={event => setEmail(event.target.value)} /></label>
    <Feedback action={action} />
    <button className={styles.primary} disabled={action.busy || !email || email.trim().toLowerCase() === currentEmail.toLowerCase()}>{action.busy ? 'Solicitando…' : 'Solicitar cambio de correo'}</button>
  </form>
}

export function CustomerPasswordForm({ customerId }: { customerId: string }) {
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [confirmation, setConfirmation] = useState('')
  const action = useAction()
  const valid = current.length > 0 && passwordSchema.safeParse(next).success && next === confirmation && current !== next
  function submit(event: FormEvent) {
    event.preventDefault(); if (!valid) return
    void action.run(async () => {
      await accountRequest('/api/customer/account/password', customerId, { currentPassword: current, newPassword: next, confirmPassword: confirmation })
      setCurrent(''); setNext(''); setConfirmation('')
    }, 'Contraseña actualizada. Usá la nueva contraseña en tu próximo ingreso.')
  }
  return <form className={styles.form} onSubmit={submit}>
    <label className={styles.field}>Contraseña actual<input aria-label="Contraseña actual" type="password" autoComplete="current-password" maxLength={128} required disabled={action.busy} value={current} onChange={event => setCurrent(event.target.value)} /></label>
    <label className={styles.field}>Nueva contraseña<input aria-label="Nueva contraseña" type="password" autoComplete="new-password" minLength={6} maxLength={12} required disabled={action.busy} value={next} onChange={event => setNext(event.target.value)} /><small>De 6 a 12 caracteres, distinta de la actual.</small></label>
    <label className={styles.field}>Repetir nueva contraseña<input aria-label="Repetir nueva contraseña" type="password" autoComplete="new-password" maxLength={12} required disabled={action.busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
    <Feedback action={action} />
    <div className={styles.actions}><button className={styles.primary} disabled={action.busy || !valid}>{action.busy ? 'Actualizando…' : 'Cambiar contraseña'}</button><Link className={styles.textAction} href="/recuperar">No recuerdo mi contraseña</Link></div>
  </form>
}

type AccountSession = { id: string; current: boolean; createdAt: string; lastSeenAt: string | null; device: string }
const dateLabel = (value: string) => new Date(value).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
export function CustomerSessionList({ sessions, customerId }: { sessions: AccountSession[]; customerId: string }) {
  const action = useAction(), router = useRouter()
  const [closed, setClosed] = useState<string[]>([])
  async function revoke(sessionId?: string) {
    await action.run(async () => {
      await accountRequest('/api/customer/account/sessions', customerId, sessionId ? { action: 'revoke', sessionId } : { action: 'revokeOthers' })
      setClosed(sessionId ? [...closed, sessionId] : sessions.filter(session => !session.current).map(session => session.id))
      router.refresh()
    }, 'Las sesiones seleccionadas quedaron cerradas.')
  }
  return <div className={styles.form}>
    <p className={styles.muted}>Podés cerrar otros accesos sin salir de este dispositivo. Si no reconocés uno, cambiá también tu contraseña.</p>
    {sessions.filter(session => !closed.includes(session.id)).map(session => <div className={styles.row} key={session.id}>
      <div className={styles.rowCopy}><strong>{session.device || 'Dispositivo no identificado'}{session.current ? ' · Sesión actual' : ''}</strong><span>Inicio: {dateLabel(session.createdAt)}</span>{session.lastSeenAt ? <span>Última actividad: {dateLabel(session.lastSeenAt)}</span> : null}</div>
      {!session.current ? <button type="button" className={styles.secondary} disabled={action.busy} aria-label={`Cerrar sesión en ${session.device}`} onClick={() => void revoke(session.id)}>Cerrar</button> : null}
    </div>)}
    <Feedback action={action} />
    <div className={styles.actions}><button type="button" className={styles.secondary} disabled={action.busy || sessions.every(session => session.current || closed.includes(session.id))} onClick={() => void revoke()}>Cerrar las otras sesiones</button><form action="/auth/logout" method="post"><button className={styles.textAction}>Cerrar esta sesión</button></form></div>
  </div>
}

type PrivacyState = { request: { id: string; status: string; createdAt: string; supportCaseId: string } | null; pending: { jobs: number; payments: number } }
export function CustomerPrivacyForm({ initialValue, customerId }: { initialValue: PrivacyState; customerId: string }) {
  const [value, setValue] = useState(initialValue), [confirmation, setConfirmation] = useState(''), [password, setPassword] = useState('')
  const idempotencyKey = useRef<string | null>(null), action = useAction()
  return <div className={styles.form}>
    <section><h2>Una copia de tus datos</h2><p className={styles.subtitle}>Descargá tus datos personales e historial registrado en Lysto. Guardá el archivo en un lugar privado.</p><a className={styles.secondary} href="/api/customer/account/export" download>Descargar mis datos</a></section>
    <section><h2>Eliminar mi cuenta</h2><p className={styles.subtitle}>Esta acción registra una solicitud para revisión. No borra automáticamente servicios, pagos ni reclamos. Podés seguir su resolución desde Ayuda.</p></section>
    {value.pending.jobs > 0 || value.pending.payments > 0 ? <p className={styles.notice}>Hay {value.pending.jobs} servicios activos y {value.pending.payments} pagos pendientes o en revisión. Se tendrán en cuenta al gestionar tu solicitud.</p> : null}
    {value.request ? <section className={styles.form}><p role="status" className={styles.notice}>Tu solicitud está registrada. Consultá su estado y las respuestas del equipo.</p><Link className={styles.primary} href={`/app/ayuda/consultas/${value.request.supportCaseId}`}>Seguir mi solicitud</Link></section> : <form className={styles.form} onSubmit={event => {
      event.preventDefault(); if (confirmation !== 'ELIMINAR' || !password) return
      idempotencyKey.current ??= crypto.randomUUID()
      void action.run(async () => {
        const result = await accountRequest<PrivacyState>('/api/customer/account/privacy', customerId, { action: 'requestDeletion', confirmation, idempotencyKey: idempotencyKey.current, currentPassword: password })
        if (!result.request?.supportCaseId) throw new Error('invalid_response')
        setValue(result); setPassword(''); setConfirmation('')
      }, 'Solicitud registrada. El historial se conserva mientras se gestiona tu pedido.')
    }}>
      <label className={styles.field}>Escribí ELIMINAR para confirmar<input aria-label="Escribí ELIMINAR para confirmar" autoComplete="off" value={confirmation} disabled={action.busy} maxLength={8} onChange={event => setConfirmation(event.target.value)} /></label>
      <label className={styles.field}>Contraseña actual<input aria-label="Contraseña actual" type="password" autoComplete="current-password" maxLength={128} value={password} disabled={action.busy} onChange={event => setPassword(event.target.value)} /></label>
      <button className={styles.danger} disabled={action.busy || confirmation !== 'ELIMINAR' || !password}>{action.busy ? 'Registrando solicitud…' : 'Solicitar eliminación de cuenta'}</button>
    </form>}
    <Feedback action={action} />
  </div>
}
