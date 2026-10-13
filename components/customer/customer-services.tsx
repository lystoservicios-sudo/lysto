'use client'

import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, FileText, Info, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CustomerServiceSummary, CustomerServicesFilter, CustomerServicesPage } from '@/features/customer/services-view-model'
import styles from './customer-services.module.css'

const filters: Array<{ id: CustomerServicesFilter; label: string }> = [
  { id: 'all', label: 'Todos' }, { id: 'in_progress', label: 'En curso' },
  { id: 'scheduled', label: 'Programados' }, { id: 'finished', label: 'Finalizados' }
]

function shortDate(value: string, timeZone = 'America/Argentina/Buenos_Aires') {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('es-AR', { timeZone, day: 'numeric', month: 'short' }).format(date)
    : null
}

function serviceDescription(item: CustomerServiceSummary) {
  if (item.visit) {
    const { startsAt, endsAt, timezone } = item.visit
    const time = new Intl.DateTimeFormat('es-AR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false })
    return `${shortDate(startsAt, timezone)} · ${time.format(new Date(startsAt))} a ${time.format(new Date(endsAt))}`
  }
  if (item.phase === 'finished' && item.completedAt) return shortDate(item.completedAt)
  return item.description ?? item.address ?? null
}

export function CustomerServices({ initialPage, initialFilter = 'all' }: {
  initialPage: CustomerServicesPage
  initialFilter?: CustomerServicesFilter
}) {
  const [page, setPage] = useState(initialPage)
  const [filter, setFilter] = useState(initialFilter)
  const [pendingFilter, setPendingFilter] = useState<CustomerServicesFilter | null>(null)
  const [busy, setBusy] = useState<'filter' | 'services' | 'quotes' | null>(null)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)
  const loadingMore = useRef(false)
  useEffect(() => () => { requestVersion.current += 1 }, [])
  useEffect(() => {
    requestVersion.current += 1
    loadingMore.current = false
    setPage(initialPage)
    setFilter(initialFilter)
    setPendingFilter(null)
    setBusy(null)
    setError('')
  }, [initialPage, initialFilter])

  async function read(parameters: URLSearchParams) {
    const response = await fetch(`/api/customer/services?${parameters}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok || !Array.isArray(body.items)) throw new Error('services_unavailable')
    return body as CustomerServicesPage
  }

  async function chooseFilter(next: CustomerServicesFilter, force = false) {
    if (!force && next === filter && !pendingFilter) return
    const version = ++requestVersion.current
    loadingMore.current = false
    setPendingFilter(next)
    setBusy('filter')
    setError('')
    try {
      const result = await read(new URLSearchParams({ filter: next }))
      if (version !== requestVersion.current) return
      setPage(result)
      setFilter(next)
    } catch {
      if (version === requestVersion.current) setError('No pudimos consultar estos servicios. Volvé a intentarlo.')
    } finally {
      if (version === requestVersion.current) { setPendingFilter(null); setBusy(null) }
    }
  }

  async function more(source: 'services' | 'quotes') {
    const cursor = source === 'services' ? page.nextServiceCursor : page.nextQuoteCursor
    if (!cursor || busy || loadingMore.current) return
    loadingMore.current = true
    const version = ++requestVersion.current
    setBusy(source)
    setError('')
    try {
      const result = await read(new URLSearchParams({
        filter, source, [source === 'services' ? 'serviceCursor' : 'quoteCursor']: cursor
      }))
      if (version !== requestVersion.current) return
      setPage((current) => {
        const merged = new Map(current.items.map((item) => [item.id, item]))
        result.items.forEach((item) => merged.set(item.id, item))
        return {
          items: [...merged.values()],
          nextServiceCursor: source === 'services' ? result.nextServiceCursor : current.nextServiceCursor,
          nextQuoteCursor: source === 'quotes' ? result.nextQuoteCursor : current.nextQuoteCursor,
          unavailableSections: [...new Set([...current.unavailableSections, ...result.unavailableSections])]
        }
      })
    } catch {
      if (version === requestVersion.current) setError('No pudimos cargar los registros anteriores. Los servicios que ya consultaste siguen disponibles.')
    } finally {
      if (version === requestVersion.current) { loadingMore.current = false; setBusy(null) }
    }
  }

  const attention = page.items.find((item) => item.phase === 'attention' && item.action)
  const remaining = page.items.filter((item) => item.id !== attention?.id)
  const active = remaining.filter((item) => !['finished', 'cancelled'].includes(item.phase))
  const finished = remaining.filter((item) => item.phase === 'finished')
  const cancelled = remaining.filter((item) => item.phase === 'cancelled')
  const hasMore = Boolean(page.nextServiceCursor || page.nextQuoteCursor)
  const unavailable = page.unavailableSections.length > 0

  return (
    <div className={styles.page}>
      <header><h1 className={styles.title}>Servicios</h1><p className={styles.subtitle}>Todo lo que pediste, en un solo lugar</p></header>
      <div className={styles.filters} role="group" aria-label="Filtrar servicios">
        {filters.map((item) => <button key={item.id} type="button" aria-pressed={(pendingFilter ?? filter) === item.id} onClick={() => void chooseFilter(item.id)}>{item.label}</button>)}
      </div>
      {error ? <p className={styles.notice} role="alert">{error}</p> : null}
      {unavailable ? <div className={styles.notice} role="status"><Info size={18} aria-hidden /><p>No pudimos consultar toda la información de {page.unavailableSections.join(', ')}.</p><button className={styles.textAction} onClick={() => void chooseFilter(filter, true)} disabled={Boolean(busy)}>Volver a consultar</button></div> : null}
      {busy === 'filter' ? <CustomerServicesSkeleton compact /> : <>
        {attention?.action ? <section className={styles.hero} aria-label="Servicio que requiere tu atención">
          <span className={styles.pill}>Requiere tu atención</span>
          <h2>{attention.statusLabel}</h2>
          <p>{attention.title}{attention.subject && attention.subject !== attention.title ? ` · ${attention.subject}` : ''}</p>
          <Link className={styles.heroAction} href={attention.action.href}>{attention.action.label}<ArrowRight size={20} aria-hidden /></Link>
        </section> : null}
        <ServiceGroup title={filter === 'scheduled' ? 'Programados' : 'En curso'} items={active} />
        <ServiceGroup title="Finalizados" items={finished} />
        <ServiceGroup title="Otros servicios" items={cancelled} />
        {!page.items.length ? <section className={styles.empty}>
          <Wrench size={24} aria-hidden />
          <h2>{unavailable ? 'La consulta está incompleta' : hasMore ? 'Seguimos buscando en tu historial' : filter === 'all' ? 'Todavía no tenés servicios' : 'No hay servicios en este estado'}</h2>
          <p>{unavailable ? 'Volvé a consultar para recuperar los registros que faltan.' : hasMore ? 'Consultá los registros anteriores para seguir buscando.' : filter === 'all' ? 'Cuando pidas un servicio, vas a poder seguirlo desde acá.' : 'Podés elegir otro filtro para consultar el resto.'}</p>
          {!hasMore && !unavailable && filter === 'all' ? <Link className={styles.primaryAction} href="/app/solicitar/aire-acondicionado">Pedir un servicio<ArrowRight size={18} aria-hidden /></Link> : null}
        </section> : null}
      </>}
      {hasMore ? <div className={styles.pagination}>
        {page.nextServiceCursor ? <button type="button" className={styles.textAction} disabled={Boolean(busy)} onClick={() => void more('services')}>{busy === 'services' ? 'Consultando servicios…' : 'Ver servicios anteriores'}<ChevronRight size={18} aria-hidden /></button> : null}
        {page.nextQuoteCursor ? <button type="button" className={styles.textAction} disabled={Boolean(busy)} onClick={() => void more('quotes')}>{busy === 'quotes' ? 'Consultando presupuestos…' : 'Ver presupuestos anteriores'}<ChevronRight size={18} aria-hidden /></button> : null}
      </div> : null}
    </div>
  )
}

function ServiceGroup({ title, items }: { title: string; items: CustomerServiceSummary[] }) {
  if (!items.length) return null
  return <section className={styles.group} aria-label={title}><h2>{title}</h2><ul className={styles.rows}>{items.map((item) => <li key={item.id}><ServiceRow item={item} /></li>)}</ul></section>
}

function ServiceRow({ item }: { item: CustomerServiceSummary }) {
  const Icon = item.phase === 'finished' ? CheckCircle2 : item.visit ? CalendarDays : item.phase === 'attention' ? FileText : Wrench
  const description = serviceDescription(item)
  const content = <>
    <span className={styles.rowIcon} data-phase={item.phase}><Icon size={22} aria-hidden /></span>
    <span className={styles.rowCopy}><strong>{item.title}</strong>{item.subject && item.subject !== item.title ? <span className={styles.rowSubject}>{item.subject}</span> : null}{description ? <span className={styles.rowDescription}>{description}</span> : null}<span className={styles.rowStatus} data-phase={item.phase}>{item.statusLabel}</span></span>
    {item.action ? <ChevronRight className={styles.chevron} size={20} aria-hidden /> : null}
  </>
  return item.action ? <Link className={styles.row} href={item.action.href}>{content}</Link> : <div className={styles.row}>{content}</div>
}

export function CustomerServicesSkeleton({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? styles.skeletonContent : styles.page} role="status" aria-label="Cargando servicios" aria-busy="true">{!compact ? <h1 className={styles.title}>Servicios</h1> : null}<span className={styles.skeletonHero} /><span className={styles.skeletonRow} /><span className={styles.skeletonRow} /><span className={styles.skeletonRow} /><span className={styles.srOnly}>Cargando servicios…</span></div>
}
