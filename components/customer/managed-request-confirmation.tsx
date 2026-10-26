'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ManagedRequestSummary } from '@/lib/admin/service-request-contract'
import { paymentResponse } from '@/components/payments/payment-response'
import styles from './customer-service-detail.module.css'

const ars = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

export function ManagedRequestConfirmation({ summary, jobId, professionalName, address, onConfirmed, onRefresh }: {
  summary: ManagedRequestSummary; jobId?: string; professionalName?: string | null; address?: string | null
  onConfirmed: () => void; onRefresh: () => void
}) {
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  const mounted = useRef(false)
  const generation = useRef(0)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current += 1 }
  }, [])
  useEffect(() => {
    generation.current += 1
    setConsent(false); setUncertain(false); setMessage('')
  }, [summary])

  async function confirm() {
    if (!consent || !summary.canAccept || pending.current || uncertain) return
    const current = generation.current
    const active = () => mounted.current && generation.current === current
    pending.current = true; setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/customer/managed-request/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: summary.id, expectedVersion: summary.version,
          assignmentVersion: summary.assignmentVersion, scheduleVersion: summary.scheduleVersion }),
        signal: AbortSignal.timeout(15000)
      })
      const body = await response.json()
      if (!active()) return
      if (!response.ok || !body.managedRequest?.summary?.acceptedAt) throw new Error('confirmation_unverified')
      setMessage('Servicio confirmado. Preparando el pago…')
      if (jobId) {
        try {
          const payment = await paymentResponse(await fetch('/api/mercadopago/create-preference', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId }),
            signal: AbortSignal.timeout(25000)
          }))
          if (!active()) return
          if (payment.initPoint) { window.location.assign(payment.initPoint); return }
        } catch {
          if (!active()) return
          setMessage('Servicio confirmado. Podés retomar el pago desde los detalles del servicio.')
        }
      }
      if (!active()) return
      onConfirmed()
    } catch {
      if (!active()) return
      setUncertain(true)
      setMessage('No pudimos verificar la confirmación. Consultá el estado antes de volver a intentar.')
    } finally { pending.current = false; if (active()) setBusy(false) }
  }

  return <div className={styles.detail}>
    <Link href="/app/trabajos" className={styles.back}>Volver a tus servicios</Link>
    <header><h1 className={styles.pageTitle}>{summary.title}</h1><p className={styles.subtitle}>Lysto preparó este servicio para vos.</p></header>
    <section className={styles.section} aria-labelledby="managed-scope">
      <h2 id="managed-scope">Tu servicio</h2><p>{summary.description}</p>
      <dl className={styles.facts}>
        {address ? <div className={styles.fact}><div className={styles.factCopy}><dt>Domicilio</dt><dd>{address}</dd></div></div> : null}
        {professionalName ? <div className={styles.fact}><div className={styles.factCopy}><dt>Profesional</dt><dd>{professionalName}</dd></div></div> : null}
        <div className={styles.fact}><div className={styles.factCopy}><dt>Visita prevista</dt><dd>{new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'long', timeStyle: 'short' }).format(new Date(summary.startsAt))} · {summary.durationMinutes} min</dd></div></div>
        <div className={styles.fact}><div className={styles.factCopy}><dt>Precio total</dt><dd className={styles.amount}>{ars(summary.total)}</dd></div></div>
      </dl>
    </section>
    {summary.canAccept ? <section className={styles.section}>
      <h2>Confirmá el servicio</h2><p>El servicio ya tiene un técnico asignado. Revisá el alcance, la visita y el importe antes de continuar.</p>
      <label className="flex items-start gap-3 py-4 text-sm"><input type="checkbox" checked={consent} disabled={busy || uncertain} onChange={event => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" />Acepto el servicio, el horario y el precio total indicado.</label>
      <button className={styles.primaryButton} disabled={!consent || busy || uncertain} onClick={() => void confirm()}>{busy ? 'Preparando pago…' : 'Confirmar y pagar'}</button>
      <p className={styles.muted}>El pago se completa con Mercado Pago. Confirmar el servicio por sí solo no realiza ningún cobro.</p>
    </section> : <section className={styles.section}><h2>Revisá el estado del servicio</h2><p>Esta solicitud no está disponible para confirmar con los datos actuales. Actualizá el estado o contactá a Lysto.</p><button className={styles.secondaryButton} disabled={busy} onClick={onRefresh}>Actualizar estado</button></section>}
    {message ? <p role="status" className={styles.notice}>{message}</p> : null}
    {uncertain ? <button className={styles.secondaryButton} onClick={onRefresh}>Consultar estado</button> : null}
  </div>
}
