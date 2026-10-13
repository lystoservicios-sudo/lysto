'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronLeft, Droplet, MapPin, MonitorCog } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useClientFocusedFlow } from '@/components/app-shell/client-flow-context'
import { QuoteBreakdown } from '@/components/pricing/quote-breakdown'
import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'
import type { ServiceQuote } from '@/lib/pricing/service-quote'
import styles from './customer-services.module.css'

type SavedQuote = {
  id: string
  status: string
  version: number
  request_id: string | null
  expires_at: string
  quote: ServiceQuote
  address: { street: string; number: string; city: string; floor?: string; apartment?: string }
}

const ars = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value)

export function CustomerQuoteDetail({ quoteId }: { quoteId: string }) {
  const router = useRouter()
  const [row, setRow] = useState<SavedQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [focused, setFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [needsRecovery, setNeedsRecovery] = useState(false)
  const [clock, setClock] = useState(Date.now())
  const pending = useRef(false)
  const generation = useRef(0)
  const mounted = useRef(false)
  const heading = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useClientFocusedFlow(focused)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const read = useCallback(async () => {
    const response = await fetch(`/api/pricing/quotes?quoteId=${encodeURIComponent(quoteId)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(15000)
    })
    const body = await response.json()
    const candidate = (body.quotes as SavedQuote[] | undefined)?.find((item) => item.id === quoteId)
    if (!response.ok || !candidate || !candidate.quote || !Number.isFinite(candidate.quote.total)) throw new Error('quote_unavailable')
    return candidate
  }, [quoteId])

  useEffect(() => {
    const current = ++generation.current
    setRow(null)
    setLoading(true)
    setFocused(false)
    setMessage('')
    setNeedsRecovery(false)
    void read().then((value) => {
      if (generation.current === current) { setRow(value); setClock(Date.now()) }
    }).catch(() => {
      if (generation.current === current) setMessage('No pudimos consultar el presupuesto. Volvé a intentarlo.')
    }).finally(() => {
      if (generation.current === current) setLoading(false)
    })
    return () => { generation.current += 1 }
  }, [read])

  useEffect(() => {
    if (!row || row.status !== 'ready') return
    const remaining = Date.parse(row.expires_at) - Date.now()
    if (!Number.isFinite(remaining) || remaining <= 0) return
    const timer = window.setTimeout(() => setClock(Date.now()), Math.min(remaining + 1, 2_147_483_647))
    return () => window.clearTimeout(timer)
  }, [row, clock])

  const close = useCallback(() => {
    if (pending.current) return
    setFocused(false)
    queueMicrotask(() => trigger.current?.focus())
  }, [])

  useEffect(() => {
    if (!focused) return
    heading.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [focused, close])

  function followAccepted(value: SavedQuote) {
    if (value.status !== 'accepted') return false
    setFocused(false)
    setMessage('Solicitud registrada. No se realizó ningún cobro.')
    if (value.request_id && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.request_id)) {
      router.replace(`/app/solicitudes/${value.request_id}`)
    }
    return true
  }

  async function consult() {
    if (pending.current) return
    pending.current = true
    const current = generation.current
    setBusy(true)
    try {
      const value = await read()
      if (generation.current !== current) return
      setRow(value)
      setClock(Date.now())
      setNeedsRecovery(false)
      setMessage('')
      followAccepted(value)
    } catch {
      if (generation.current === current) setMessage('No pudimos verificar el estado. Consultalo antes de volver a aceptar.')
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
      if (generation.current === current) setLoading(false)
    }
  }

  async function accept() {
    if (!row || pending.current || needsRecovery || row.status !== 'ready' || !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= Date.now()) return
    pending.current = true
    const current = generation.current
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/customer/request/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: row.id, expectedVersion: row.version }),
        signal: AbortSignal.timeout(15000)
      })
      const body = await response.json()
      if (!response.ok || !body.accepted) throw new Error('quote_acceptance_unconfirmed')
      // Persisted quote state is the authority for both success and ambiguous responses.
      const value = await read()
      if (generation.current !== current) return
      setRow(value)
      setClock(Date.now())
      if (!followAccepted(value)) throw new Error('quote_acceptance_unconfirmed')
    } catch {
      try {
        const value = await read()
        if (generation.current !== current) return
        setRow(value)
        setClock(Date.now())
        setNeedsRecovery(false)
        if (!followAccepted(value)) setMessage('La aceptación no quedó confirmada. Revisá el estado actualizado antes de reintentar.')
      } catch {
        if (generation.current === current) {
          setNeedsRecovery(true)
          setMessage('No pudimos verificar el estado. Consultalo antes de volver a aceptar.')
        }
      }
    } finally {
      // The pending operation prevents any new submission, even after navigation.
      // Release that shared lock without applying the previous quote's result.
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }

  if (loading) return <div className={styles.page} role="status" aria-busy="true"><h1 className={styles.title}>Presupuesto</h1><span className={styles.skeletonHero} /><span className={styles.srOnly}>Cargando presupuesto…</span></div>
  if (!row) return <div className={styles.page}><Link className={styles.backLink} href="/app/trabajos"><ChevronLeft size={18} aria-hidden />Servicios</Link><h1 className={styles.title}>Presupuesto</h1><p role="alert" className={styles.notice}>{message}</p><button className={styles.textAction} disabled={busy} onClick={() => void consult()}>Volver a consultar</button></div>

  const expiry = Date.parse(row.expires_at)
  const expired = !Number.isFinite(expiry) || expiry <= clock
  const ready = row.status === 'ready' && !expired
  const accepted = row.status === 'accepted'
  const status = accepted ? 'Presupuesto aceptado' : row.status === 'superseded' ? 'Presupuesto reemplazado' : expired ? 'Presupuesto vencido' : ready ? 'Presupuesto listo' : 'Presupuesto en revisión'
  const issue = AIR_CONDITIONING_ISSUES.find((item) => item.slug === row.quote.issue)?.title ?? 'Aire acondicionado'
  const title = row.quote.issue === 'mantenimiento' ? 'Mantenimiento de aire' : row.quote.issue === 'instalacion' ? 'Instalación de aire' : 'Reparación de aire'
  const address = `${row.address.street} ${row.address.number} · ${row.address.city}`

  return <div className={styles.page}>
    {focused ? <div className={styles.focused}>
      <div className={styles.focusedHeader} ref={heading} tabIndex={-1}><button className={styles.backLink} disabled={busy} onClick={close}><ChevronLeft size={18} aria-hidden />Volver al servicio</button><h1 className={styles.title}>Revisar presupuesto</h1></div>
      <QuoteBreakdown quote={row.quote} internal={false} status={row.status} />
      <p className={styles.hint}><span>{status}</span>{Number.isFinite(expiry) ? ` · Vigencia: ${new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }).format(new Date(expiry))}` : ''}</p>
      <p className={styles.subtitle}>Aceptar registra tu solicitud. Podrás pagar cuando el profesional confirme el servicio.</p>
      {message ? <p className={styles.notice} role="status">{message}</p> : null}
      <div className={styles.flowActions}>{!accepted ? <button disabled={!ready || busy || needsRecovery} onClick={() => void accept()}>{busy ? 'Consultando…' : 'Aceptar y solicitar profesional'}</button> : null}{needsRecovery ? <button data-secondary disabled={busy} onClick={() => void consult()}>Consultar estado</button> : null}</div>
    </div> : <>
      <Link className={styles.backLink} href="/app/trabajos"><ChevronLeft size={18} aria-hidden />Servicios</Link>
      <header><h1 className={styles.title}>{title}</h1><p className={styles.subtitle}>{issue} · #{row.id.slice(0, 8)}</p></header>
      <section className={styles.hero} data-muted={!ready || undefined}>
        <span className={styles.pill}>{ready ? 'Requiere tu atención' : 'Estado del presupuesto'}</span><h2>{status}</h2><p>{row.quote.scope}</p><strong className={styles.amount}>{ars(row.quote.total)}</strong>
        {accepted && row.request_id ? <Link className={styles.heroAction} href={`/app/solicitudes/${row.request_id}`}>Ver servicio<ArrowRight size={20} aria-hidden /></Link> : <button className={styles.heroAction} ref={trigger} onClick={() => setFocused(true)}>{ready ? 'Revisar presupuesto' : 'Ver presupuesto'}<ArrowRight size={20} aria-hidden /></button>}
      </section>
      <p className={styles.hint}>Aceptar el presupuesto no realiza ningún cobro.</p>
      {message ? <p className={styles.notice} role="status">{message}</p> : null}
      <section className={styles.group}><h2>Tu solicitud</h2><dl className={styles.facts}>
        <QuoteFact icon={Droplet} label="Problema" value={issue} /><QuoteFact icon={MonitorCog} label="Equipo" value="Aire acondicionado" /><QuoteFact icon={MapPin} label="Domicilio" value={address} />
      </dl></section>
      {!accepted ? <section className={styles.group}><h2>Qué sigue</h2><ol className={styles.steps}><li>Revisás y aceptás el presupuesto</li><li>Lysto asigna un profesional</li><li>Cuando acepte, se habilita el pago</li></ol></section> : null}
    </>}
  </div>
}

function QuoteFact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return <div className={styles.fact}><span className={styles.rowIcon}><Icon size={22} aria-hidden /></span><div><dt>{label}</dt><dd>{value}</dd></div></div>
}
