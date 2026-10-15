'use client'

import Link from 'next/link'
import { CalendarDays, Snowflake } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { MoreEmpty, moreStyles } from '@/components/customer/more/more-ui'
import { maintenanceDate, maintenancePresentation } from '@/lib/customer/maintenance-presentation'
import type { MaintenancePlan } from '@/lib/equipment/maintenance-service'
import { privateRequest, requestError } from '@/lib/http/private-client'
import styles from './customer-maintenance.module.css'

export function ConnectedCustomerMaintenance() {
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [dates, setDates] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const savingRef = useRef(false)
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await privateRequest<{ maintenance: MaintenancePlan[] }>('/api/maintenance/schedule')
      setPlans(result.maintenance)
      setLoaded(true)
      setNeedsRefresh(false)
    } catch (cause) {
      setError(requestError(cause))
      setNeedsRefresh(true)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function defer(event: FormEvent<HTMLFormElement>, plan: MaintenancePlan) {
    event.preventDefault()
    if (savingRef.current || needsRefresh || !maintenancePresentation(plan).canDefer) return
    savingRef.current = true
    setSaving(plan.id)
    setError('')
    setMessage('')
    try {
      const result = await privateRequest<{ plan: { status: string; dueAt: string | null; version: number } }>(
        '/api/maintenance/schedule', 'POST', {
          planId: plan.id, action: 'defer', expectedVersion: plan.version, dueDate: dates[plan.id]
        })
      if (result.plan.status !== 'deferred') {
        await load()
        setMessage('La recomendación cambió. Consultá su estado actualizado antes de continuar.')
        return
      }
      setPlans((current) => current.map((item) => item.id === plan.id
        ? { ...item, status: 'deferred', dueAt: result.plan.dueAt, version: result.plan.version } : item))
      setEditing(null)
      setMessage('Nueva fecha recomendada guardada. Esto no cambia ni reserva una visita.')
      await load()
    } catch (cause) {
      setError(`${requestError(cause)} Consultá el estado actualizado antes de volver a guardar.`)
      setNeedsRefresh(true)
    } finally {
      savingRef.current = false
      setSaving(null)
    }
  }

  const visible = plans.filter((plan) => !plan.superseded && plan.recommendation !== 'none')
  return <div className={styles.content}>
    <p className={moreStyles.muted}>Son recomendaciones del historial técnico de tus aires. Una fecha recomendada no es una visita reservada.</p>
    {error ? <div role="alert" className={moreStyles.error}>{error}</div> : null}
    {message ? <p role="status" className={moreStyles.success}>{message}</p> : null}
    {loading ? <p role="status" className={moreStyles.muted}>Cargando mantenimientos…</p> : null}
    {error || loaded && plans.some((plan) => !plan.contextVerified) ?
      <button type="button" className={moreStyles.secondary} disabled={loading || saving !== null}
        onClick={() => void load()}>Actualizar información</button> : null}
    {loaded && !visible.length ? <MoreEmpty title="Sin mantenimientos pendientes"
      description="Cuando un profesional recomiende un cuidado para tus equipos, vas a encontrarlo acá." /> : null}
    {visible.map((plan) => {
      const view = maintenancePresentation(plan)
      return <article key={plan.id} className={styles.plan} aria-label={`Mantenimiento de ${plan.equipmentName}`}>
        <header className={styles.header}>
          <span className={styles.icon}><Snowflake size={19} aria-hidden="true" /></span>
          <div><p className={styles.status}>{view.status}</p><h2>{plan.equipmentName}</h2></div>
        </header>
        <h3 className={styles.recommendation}>{view.label}</h3>
        <p className={styles.date}><CalendarDays size={17} aria-hidden="true" />
          <span>Fecha recomendada: {maintenanceDate(plan.dueAt)}</span></p>
        {view.note ? <p className={moreStyles.notice}>{view.note}</p> : null}
        <div className={moreStyles.actions}>
          {view.action && !needsRefresh ? <Link className={moreStyles.primary} href={view.action.href}>{view.action.label}</Link> : null}
          {plan.status === 'suppressed_by_case' ? <Link className={moreStyles.secondary} href="/app/garantias">Ver garantías y reclamos</Link> : null}
          {view.canDefer ? <button type="button" className={moreStyles.textAction} disabled={saving !== null || loading || needsRefresh}
            aria-expanded={editing === plan.id} onClick={() => setEditing(editing === plan.id ? null : plan.id)}>Cambiar fecha recomendada</button> : null}
        </div>
        {editing === plan.id && view.canDefer ? <form className={styles.dateForm} onSubmit={(event) => void defer(event, plan)}>
          <div className={moreStyles.field}><label htmlFor={`maintenance-date-${plan.id}`}>Nueva fecha recomendada</label>
            <input id={`maintenance-date-${plan.id}`} type="date" required value={dates[plan.id] ?? ''}
              aria-describedby={`maintenance-date-help-${plan.id}`}
              disabled={saving !== null} onChange={(event) => setDates((current) => ({ ...current, [plan.id]: event.target.value }))} />
            <small id={`maintenance-date-help-${plan.id}`}>Elegí una fecha futura. Solo se actualiza esta recomendación, no un servicio programado.</small>
          </div>
          <button className={moreStyles.secondary} type="submit" disabled={saving !== null || needsRefresh}>
            {saving === plan.id ? 'Guardando…' : 'Guardar fecha'}</button>
        </form> : null}
        <details className={styles.history}>
          <summary>Historial técnico ({plan.history.length})</summary>
          {plan.history.length ? plan.history.map((record) => <div key={record.id} className={styles.record}>
            <p className={moreStyles.muted}>{maintenanceDate(record.performedAt)}</p>
            {record.diagnosis ? <p>{record.diagnosis}</p> : null}
            {record.workDone ? <p>{record.workDone}</p> : null}
            {record.jobId ? <Link className={moreStyles.textAction} href={`/app/trabajos/${record.jobId}`}>Ver detalle del servicio</Link> : null}
          </div>) : <p className={moreStyles.muted}>Todavía no hay intervenciones registradas para este equipo.</p>}
        </details>
      </article>
    })}
    <div className={moreStyles.footer}><Link href="/app/hogar">Ver mis equipos en Hogar</Link><Link href="/app/trabajos">Ver mis servicios</Link></div>
  </div>
}
