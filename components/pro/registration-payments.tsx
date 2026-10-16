'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, CheckCircle2, Link2, LoaderCircle, ShieldCheck } from 'lucide-react'
import type { RegistrationAccount } from '@/lib/professional/registration-model'
import styles from './registration-payments.module.css'

export type RegistrationAccountState = {
  account: RegistrationAccount | null
  loading: boolean
  error: string
  refresh: () => Promise<RegistrationAccount | null>
}

function readAccount(value: unknown): RegistrationAccount {
  if (!value || typeof value !== 'object' || !('configured' in value) || typeof value.configured !== 'boolean'
    || !('linked' in value) || (typeof value.linked !== 'boolean' && value.linked !== null)
    || ('mode' in value && value.mode !== 'live' && value.mode !== 'test')
    || ('accountId' in value && value.accountId !== null && typeof value.accountId !== 'string')
    || (!value.configured && value.linked !== null)
    || (value.configured && value.linked === null)) throw new Error('invalid_account')
  return value as RegistrationAccount
}

async function jsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(response.status === 401 ? 'session_expired' : response.status === 403 ? 'account_denied' : 'account_unavailable')
  return response.json() as Promise<unknown>
}

/** Only an acknowledged account read establishes connection, scoped to its applicant. */
export function useRegistrationAccount(professionalId: string): RegistrationAccountState {
  const [snapshot, setSnapshot] = useState<{ identity: string; account: RegistrationAccount | null; loading: boolean; error: string }>({ identity: professionalId, account: null, loading: Boolean(professionalId), error: '' })
  const identity = useRef(professionalId)
  identity.current = professionalId
  const mounted = useRef(false)
  const epoch = useRef(0)
  const request = useRef<AbortController | null>(null)
  const stop = useCallback(() => { mounted.current = false; ++epoch.current; request.current?.abort() }, [])

  const refresh = useCallback(async (): Promise<RegistrationAccount | null> => {
    const ticket = ++epoch.current
    request.current?.abort()
    if (!professionalId || !mounted.current || identity.current !== professionalId) return null
    const controller = new AbortController()
    request.current = controller
    const timeout = setTimeout(() => controller.abort(), 20000)
    setSnapshot({ identity: professionalId, account: null, loading: true, error: '' })
    const current = () => mounted.current && epoch.current === ticket && identity.current === professionalId
    try {
      const response = await fetch('/api/mercadopago/account', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      const account = readAccount(await jsonResponse(response))
      if (!current()) return null
      setSnapshot({ identity: professionalId, account, loading: false, error: '' })
      return account
    } catch (error) {
      if (!current()) return null
      const message = error instanceof Error && error.message === 'session_expired'
        ? 'Tu sesión terminó. Volvé a iniciar sesión para consultar la conexión.'
        : error instanceof Error && error.message === 'account_denied'
          ? 'No pudimos verificar el acceso a tu cuenta. Volvé a iniciar sesión.'
          : 'No pudimos verificar tu conexión. Volvé a consultar antes de continuar.'
      setSnapshot({ identity: professionalId, account: null, loading: false, error: message })
      return null
    } finally {
      clearTimeout(timeout)
      if (request.current === controller) request.current = null
    }
  }, [professionalId])

  useEffect(() => {
    mounted.current = true
    void refresh()
    return stop
  }, [refresh, stop])

  return { ...(snapshot.identity === professionalId ? snapshot : { account: null, loading: Boolean(professionalId), error: '' }), refresh }
}

const authorizationHosts = new Set(['auth.mercadopago.com', 'auth.mercadopago.com.ar', 'auth.mercadopago.com.br', 'auth.mercadopago.com.mx', 'auth.mercadopago.cl', 'auth.mercadopago.com.co', 'auth.mercadopago.com.pe', 'auth.mercadopago.com.uy'])
function authorizationDestination(value: unknown): string {
  if (!value || typeof value !== 'object' || !('url' in value) || typeof value.url !== 'string' || value.url.length > 8192) throw new Error('invalid_authorization')
  const url = new URL(value.url)
  if (url.protocol !== 'https:' || !authorizationHosts.has(url.hostname) || url.port || url.username || url.password || url.pathname !== '/authorization' || url.hash || !url.searchParams.get('state')) throw new Error('invalid_authorization')
  return url.toString()
}

export function RegistrationPayments({ state }: { state: RegistrationAccountState }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const [callbackFailed, setCallbackFailed] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(false)
  const epoch = useRef(0)
  const identity = useRef(state.refresh)
  identity.current = state.refresh
  const request = useRef<AbortController | null>(null)
  const stop = useCallback(() => { mounted.current = false; ++epoch.current; request.current?.abort() }, [])
  useEffect(() => {
    mounted.current = true; pending.current = false; setBusy(false); setMessage('')
    const outcome = new URLSearchParams(window.location.search).get('conexion')
    setCancelled(outcome === 'cancelada'); setCallbackFailed(outcome === 'fallida')
    return stop
  }, [state.refresh, stop])

  async function connect() {
    if (pending.current || state.loading || state.error || !state.account?.configured || state.account.linked !== false) return
    pending.current = true
    setBusy(true); setMessage(''); setCallbackFailed(false)
    const ticket = ++epoch.current, applicant = state.refresh
    const controller = new AbortController(); request.current = controller
    const timeout = setTimeout(() => controller.abort(), 20000)
    const current = () => mounted.current && epoch.current === ticket && identity.current === applicant
    try {
      const response = await fetch('/api/mercadopago/oauth/authorize', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnTo: 'onboarding' })
      })
      const destination = authorizationDestination(await jsonResponse(response))
      if (current()) window.location.assign(destination)
    } catch (error) {
      if (!current()) return
      setMessage(error instanceof Error && error.message === 'session_expired'
        ? 'Tu sesión terminó. Volvé a iniciar sesión para vincular tu cuenta.'
        : 'No pudimos abrir la vinculación. Consultá el estado de tu cuenta antes de reintentar.')
      setBusy(false); pending.current = false
    } finally {
      clearTimeout(timeout)
      if (request.current === controller) request.current = null
    }
  }

  const connected = state.account?.configured === true && state.account.linked === true
  const testConnection = connected && state.account?.mode === 'test'
  const unavailable = state.account?.configured === false
  const error = message || state.error
  return <section className={styles.root} data-mp-marketplace-page="checkout-pro" aria-label="Cuenta de cobro">
    <div className={styles.provider}>Mercado Pago</div>
    <ol className={styles.steps} aria-label="Cómo vincular tu cuenta">
      {[
        ['Abrís Mercado Pago', 'Te redirigimos de forma segura.'],
        ['Revisás los permisos', 'Autorizás la conexión con Lysto.'],
        ['Volvés a Lysto', 'Verificamos la vinculación en esta misma sección.']
      ].map(([title, detail], index) => <li key={title}><span className={styles.number} aria-hidden="true">{index + 1}</span><div><strong>{title}</strong><p>{detail}</p></div></li>)}
    </ol>
    <p className={styles.notice}><ShieldCheck size={20} aria-hidden="true" /><span>Lysto no te pide tu contraseña de Mercado Pago.</span></p>
    {state.loading ? <p className={styles.status} role="status"><LoaderCircle className={styles.spinner} size={20} aria-hidden="true" />Consultando tu conexión…</p>
      : testConnection ? <div className={styles.testConnection}><p role="status"><Link2 size={20} aria-hidden="true" />Conexión de prueba</p><p>Esta autorización es de prueba. No confirma cobros reales ni habilitación para trabajar.</p></div>
        : connected ? <div className={styles.connected}><p role="status"><CheckCircle2 size={20} aria-hidden="true" />Cuenta vinculada</p><p>Completaste la conexión de cobros. Esto no reemplaza la revisión de tu postulación.</p></div>
        : <p className={styles.status}><Link2 size={20} aria-hidden="true" />{error || unavailable ? 'Conexión sin verificar' : 'Todavía sin vincular'}</p>}
    {cancelled && !connected && !state.loading && <p className={styles.hint}>Cancelaste la vinculación. Tus datos siguen guardados y podés retomarla cuando quieras.</p>}
    {callbackFailed && !connected && !state.loading && <p role="alert" className={styles.error}>No pudimos confirmar la vinculación al volver de Mercado Pago. Volvé a consultar el estado y podés reintentar sin perder tu postulación.</p>}
    {unavailable && <p role="alert" className={styles.error}>La vinculación no está disponible en este momento. Podés volver a consultar sin perder tu postulación.</p>}
    {state.account?.mode === 'test' && <p role="alert" className={styles.error}>Conexión de prueba: no la uses para cobrar trabajos reales.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!connected && <button type="button" data-mp-marketplace-connect="oauth" className={styles.primary} disabled={busy || state.loading || Boolean(error) || !state.account?.configured || state.account.linked !== false} onClick={() => void connect()}>
      {busy ? 'Abriendo Mercado Pago…' : 'Vincular Mercado Pago'}{busy ? <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}
    </button>}
    {!state.loading && (Boolean(error) || unavailable || callbackFailed && !connected) && <button type="button" className={styles.secondary} disabled={busy} onClick={() => { setMessage(''); setCallbackFailed(false); void state.refresh() }}>Volver a consultar</button>}
    {!connected && <p className={styles.hint}>Si cancelás, podés retomarlo.</p>}
  </section>
}
