'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, FileText, MapPin, Monitor, ReceiptText, UserRound, Wrench } from 'lucide-react'
import { useClientFocusedFlow } from '@/components/app-shell/client-flow-context'
import { PaymentPanel } from '@/components/payments/payment-panel'
import { QuoteBreakdown } from '@/components/pricing/quote-breakdown'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'
import { jobStatusLabels } from '@/lib/domain/job-status-labels'
import { customerInitialPaymentState } from '@/features/customer/services-view-model'
import { isExpiredAutomaticRequest } from '@/lib/jobs/visit-address'
import type { JobStatus } from '@/lib/domain/types'
import type { ServiceQuote } from '@/lib/pricing/service-quote'
import type { CustomerJobVisit } from './job-visit-card'
import styles from './customer-service-detail.module.css'

type Extra = { id: string; fault: string; description: string; amount: number; status: string }
type Diagnosis = { id: string; actual_diagnosis: string; base_scope: string; evidence_ids: string[]; status: string; version: number; decision_reason: string | null }
type FinalReport = { id: string; real_diagnosis: string; work_done: string; parts_used?: string | null; final_state: string; maintenance_option: string; next_maintenance_date?: string | null; warranty_days?: number; after_photo_ids: string[]; version: number; created_at: string }
export type CustomerServiceDetailData = {
  role: string
  job: { id: string; status: string; professionalName: string | null; contractSource?: string | null; requestStatus?: string }
  visitAddressLabel?: string | null
  equipmentId: string | null
  visit: CustomerJobVisit | null
  onsiteDiagnosis: Diagnosis | null
  finalReport: FinalReport | null
  savedQuote: { status: string; quote: ServiceQuote; input?: { issue?: string }; expires_at?: string; address: { street: string; number: string; floor?: string; apartment?: string; city: string } } | null
  extras: Extra[]
  customerService?: { issueLabel: string; equipmentName: string | null; addressLabel: string | null }
}
type Flow = 'quote' | 'payments' | 'report' | 'dispute' | 'scope' | 'extra'
type Checkout = { id: string; job_id: string; extra_id: string | null; status: string }
const finalStateLabels: Record<string, string> = { resolved: 'Problema resuelto', partially_resolved: 'Resuelto parcialmente', pending_part: 'Repuesto pendiente', requires_second_visit: 'Segunda visita necesaria', not_resolved: 'Problema sin resolver' }
const issueLabels: Record<string, string> = { no_enfria: 'No enfría', pierde_agua: 'Pierde agua', hace_ruido: 'Hace ruido', no_enciende: 'No enciende', no_funciona_calor: 'No calienta', instalacion: 'Instalación', mantenimiento: 'Mantenimiento' }
const flowTitles: Record<Flow, string> = { quote: 'Presupuesto del servicio', payments: 'Pago del servicio', report: 'Informe del servicio', dispute: 'Informar un desacuerdo', scope: 'Diagnóstico y alcance', extra: 'Trabajo adicional' }
const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value)
const datePart = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', ...options }).format(new Date(value))

function Fact({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return <div className={styles.fact}><span className={styles.factIcon}><Icon size={21} aria-hidden="true" /></span><div className={styles.factCopy}><dt>{label}</dt><dd>{children}</dd></div></div>
}

function PrivatePhotos({ ids, label = 'informe' }: { ids: string[]; label?: string }) {
  const [preview, setPreview] = useState<{ url: string; index: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)
  useEffect(() => () => { requestVersion.current += 1 }, [])
  async function view(id: string, index: number) {
    const version = ++requestVersion.current
    setBusy(true); setError(''); setPreview(null)
    try {
      const response = await fetch('/api/uploads/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: id }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudo abrir la foto.')
      if (typeof body.url !== 'string') throw new Error('No se pudo abrir la foto.')
      if (version === requestVersion.current) setPreview({ url: body.url, index })
    } catch (failure) { if (version === requestVersion.current) setError(failure instanceof Error ? failure.message : 'No se pudo abrir la foto.') }
    finally { if (version === requestVersion.current) setBusy(false) }
  }
  return <section className={styles.photoSection} aria-label={`Fotos del ${label}`}>
    <h2>Fotos y evidencias</h2>
    <p className={styles.muted}>Las fotos se abren mediante un enlace privado temporal.</p>
    <div className={styles.inlineActions}>{ids.map((id, index) => <button key={id} className={styles.secondaryButton} disabled={busy} onClick={() => void view(id, index)}>Ver foto {index + 1}</button>)}</div>
    {error ? <p role="status" className={styles.notice}>{error}</p> : null}
    {preview ? <Image src={preview.url} unoptimized width={640} height={480} alt={`Foto del ${label} ${preview.index + 1}`} className={styles.photo} onError={() => { setPreview(null); setError('La foto venció o no está disponible. Volvé a abrirla.') }} /> : null}
  </section>
}

function ReportContent({ report, photos = false }: { report: FinalReport; photos?: boolean }) {
  const followup = ['pending_part', 'requires_second_visit', 'not_resolved', 'partially_resolved'].includes(report.final_state)
  return <section className={styles.section}>
    <h2>Informe de la visita</h2>
    <p className={styles.muted}>{datePart(report.created_at, { day: 'numeric', month: 'short' })} · Versión {report.version}</p>
    <dl className={styles.facts}>
      <Fact icon={FileText} label="Diagnóstico">{report.real_diagnosis}</Fact>
      <Fact icon={Wrench} label="Trabajo realizado">{report.work_done}</Fact>
      <Fact icon={CheckCircle2} label="Resultado informado">{finalStateLabels[report.final_state] ?? 'Resultado disponible en el informe'}</Fact>
      {report.parts_used ? <Fact icon={Monitor} label="Repuestos y pendientes">{report.parts_used}</Fact> : null}
    </dl>
    {followup ? <p className={styles.notice}>Este resultado requiere seguimiento; no lo tratamos como resuelto.</p> : null}
    {report.next_maintenance_date && report.maintenance_option !== 'none' ? <p className={styles.muted}>Próximo cuidado recomendado: {datePart(`${report.next_maintenance_date}T12:00:00-03:00`, { day: 'numeric', month: 'long', year: 'numeric' })}. <Link href="/app/mantenimientos">Ver mantenimiento</Link></p> : null}
    {photos && report.after_photo_ids.length ? <PrivatePhotos ids={report.after_photo_ids} /> : null}
  </section>
}

export function CustomerServiceDetail({ data, onReload, reloadError = '', reloadInProgress = false }: { data: CustomerServiceDetailData; onReload: () => void; reloadError?: string; reloadInProgress?: boolean }) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [selectedExtra, setSelectedExtra] = useState<string | null>(null)
  const [checkouts, setCheckouts] = useState<Checkout[] | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [paymentRevision, setPaymentRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const paymentBusyRef = useRef(false)
  const onPaymentBusyChange = useCallback((pending: boolean) => { paymentBusyRef.current = pending; setPaymentBusy(pending) }, [])
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState('')
  const [committed, setCommitted] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const triggerLabel = useRef<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const openedForConfirmation = useRef(false)
  const handledEntry = useRef<string | null>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  useClientFocusedFlow(flow !== null)
  const status = data.job.status
  const expiredContract = isExpiredAutomaticRequest({ contractSource: data.job.contractSource, status: data.job.requestStatus })
  const terminal = expiredContract || status.startsWith('cancelled') || status === 'disputed' || status === 'warranty_claim'
  const canConfirm = !terminal && status === 'completed_pending_customer_confirmation' && Boolean(data.finalReport) && !committed
  const scopePending = !terminal && data.onsiteDiagnosis?.status === 'submitted'
  const proposedExtras = terminal ? [] : data.extras.filter(extra => extra.status === 'proposed')
  const extra = data.extras.find(item => item.id === selectedExtra)
  const issue = data.savedQuote?.input?.issue
  const issueLabel = data.customerService?.issueLabel ?? issueLabels[issue ?? ''] ?? 'Aire acondicionado'
  const equipmentName = data.customerService?.equipmentName
  const address = data.job.contractSource != null ? data.customerService?.addressLabel ?? data.visitAddressLabel ?? null
    : data.customerService?.addressLabel ?? data.visit?.addressLabel ?? (data.savedQuote ? [data.savedQuote.address.street, data.savedQuote.address.number, data.savedQuote.address.city].filter(Boolean).join(' ') : null)
  const title = issue === 'mantenimiento' ? 'Mantenimiento de aire' : issue === 'instalacion' ? 'Instalación de aire' : 'Reparación de aire'
  const initialCheckout = checkouts?.find(item => item.extra_id === null)
  const paymentState = checkouts ? customerInitialPaymentState(checkouts.map(item => ({ jobId: item.job_id, extraId: item.extra_id, status: item.status })), data.job.id) : 'unknown'
  const paid = paymentState === 'approved'
  const paymentBlocked = paymentState === 'follow_up' || paymentState === 'unknown'
  const beforeVisit = ['pending_assignment', 'pending_professional_acceptance', 'confirmed'].includes(status)
  const blocked = busy || paymentBusy || reloadInProgress || Boolean(reloadError)
  const reloadNotice = reloadError ? <div className={styles.notice}><p role="status">{reloadError}</p><p>Conservamos los datos de la última consulta. Verificá el estado antes de enviar otra decisión.</p><button className={styles.secondaryButton} disabled={busy || reloadInProgress} onClick={onReload}>Volver a consultar el servicio</button></div> : reloadInProgress ? <p role="status" className={styles.notice}>Verificando el estado del servicio antes de continuar…</p> : null

  useEffect(() => {
    let active = true
    setCheckouts(null); setPaymentError('')
    fetch(`/api/mercadopago/checkouts?jobId=${encodeURIComponent(data.job.id)}`)
      .then(async response => { const body = await response.json(); if (!response.ok || !Array.isArray(body.checkouts)) throw new Error(body.error ?? 'No pudimos consultar el estado del pago.'); if (active) setCheckouts(body.checkouts) })
      .catch(error => { if (active) setPaymentError(error instanceof Error ? error.message : 'No pudimos consultar el estado del pago.') })
    return () => { active = false }
  }, [data.job.id, data, paymentRevision])

  useEffect(() => {
    function checkEntry() {
      const url = new URL(window.location.href)
      if (handledEntry.current === url.href) return
      handledEntry.current = url.href
      const hash = url.hash
      if (['retorno', 'pendiente', 'reintentar'].includes(url.searchParams.get('pago') ?? '') || /^#pagos?$/.test(hash)) setFlow('payments')
      else if (hash === '#informe' && data.finalReport) { openedForConfirmation.current = status === 'completed_pending_customer_confirmation'; setFlow('report') }
      else if (hash === '#adicionales' && !terminal && data.extras.some(item => item.status === 'proposed')) { setSelectedExtra(data.extras.find(item => item.status === 'proposed')!.id); setFlow('extra') }
    }
    checkEntry(); window.addEventListener('hashchange', checkEntry)
    return () => window.removeEventListener('hashchange', checkEntry)
  }, [data.job.id, data.visit, data.finalReport, data.extras, status, terminal])

  useEffect(() => {
    if (flow) heading.current?.focus()
  }, [flow])
  useEffect(() => {
    if ((status === 'completed' || terminal) && openedForConfirmation.current && (flow === 'dispute' || flow === 'report')) setFlow(null)
  }, [status, terminal, committed, flow])
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape' && flow && !busyRef.current && !paymentBusyRef.current) { event.preventDefault(); setFlow(null); setPaymentRevision(value => value + 1); queueMicrotask(restoreFocus) } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [flow])

  function openFlow(next: Flow, event?: MouseEvent<HTMLButtonElement>, extraId?: string) {
    if (expiredContract && ['dispute', 'extra', 'scope'].includes(next)) return
    trigger.current = event?.currentTarget ?? document.activeElement as HTMLElement
    triggerLabel.current = event?.currentTarget.textContent ?? null
    openedForConfirmation.current = canConfirm && (next === 'report' || next === 'dispute')
    setSelectedExtra(extraId ?? null); setMessage(''); setReason(''); setFlow(next)
  }
  function closeFlow() {
    if (busyRef.current || paymentBusyRef.current) return
    setFlow(null); setPaymentRevision(value => value + 1); onReload()
    queueMicrotask(restoreFocus)
  }
  function restoreFocus() {
    const equivalent = triggerLabel.current
      ? Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(button => button.textContent === triggerLabel.current)
      : null
    ;(trigger.current?.isConnected ? trigger.current : equivalent ?? detailHeading.current)?.focus()
  }
  async function command(url: string, method: 'POST' | 'PATCH', scope: string, payload: Record<string, unknown>, recoverable = true) {
    if (expiredContract || busyRef.current || reloadInProgress || reloadError) return false
    busyRef.current = true; setBusy(true); setMessage('')
    let serverMessage: string | null = null
    try {
      const pending = recoverable ? recoverCommand(sessionStorage, `${data.job.id}:${scope}`, JSON.stringify(payload)) : null
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending ? { ...payload, idempotencyKey: pending.key } : payload) })
      const body = await response.json()
      if (!response.ok) { serverMessage = typeof body.error === 'string' ? body.error : 'No se pudo completar la operación.'; throw new Error(serverMessage ?? 'No se pudo completar la operación.') }
      if (pending) acknowledgeCommand(sessionStorage, `${data.job.id}:${scope}`, pending.key)
      if (scope === 'customer-decision') setCommitted(true)
      setMessage('Decisión registrada. Actualizando el servicio…')
      setFlow(null)
      onReload(); setPaymentRevision(value => value + 1)
      return true
    } catch {
      setMessage(serverMessage ?? 'No pudimos confirmar la decisión. Consultaremos el estado antes de reintentar sin duplicar.')
      onReload()
      return false
    } finally { busyRef.current = false; setBusy(false) }
  }
  function outcome(decision: 'confirmed' | 'disputed') {
    if (!canConfirm || (decision === 'disputed' && (reason.trim().length < 10 || reason.trim().length > 3000))) return
    void command('/api/jobs/confirm', 'POST', 'customer-decision', { jobId: data.job.id, decision, ...(decision === 'disputed' ? { reason: reason.trim() } : {}) })
  }
  function scopeDecision(decision: 'accepted' | 'changes_requested') {
    if (!scopePending || !data.onsiteDiagnosis || (decision === 'changes_requested' && reason.trim().length < 10)) return
    void command('/api/pricing/job/status', 'POST', 'scope-decision', { action: 'decideScope', jobId: data.job.id, decision, expectedVersion: data.onsiteDiagnosis.version, ...(decision === 'changes_requested' ? { reason: reason.trim() } : {}) })
  }
  const outcomeButtons = <div className={styles.decision}><p>Confirmar completa el servicio. La valoración es opcional y se ofrece después. No aplicamos conformidad por silencio.</p><button className={styles.primaryButton} disabled={blocked || !canConfirm} onClick={() => outcome('confirmed')}>Confirmar servicio</button><button className={styles.secondaryButton} disabled={blocked || !canConfirm} onClick={event => openFlow('dispute', event)}>Informar un desacuerdo</button></div>

  if (flow) return <div className={styles.detail} ref={root} data-client-focused-service>
    <button className={styles.back} disabled={busy || paymentBusy} onClick={closeFlow}><ArrowLeft size={18} aria-hidden="true" />Volver al servicio</button>
    <h1 className={styles.pageTitle} ref={heading} tabIndex={-1}>{flowTitles[flow]}</h1>
    {reloadNotice}
    {message ? <p role="status" className={styles.notice}>{message}</p> : null}
    {flow === 'payments' && !reloadError && !reloadInProgress ? <div className={styles.reused}><PaymentPanel role="customer" jobId={data.job.id} jobStatus={status} serviceAmount={data.savedQuote?.quote.total} extras={data.extras} readOnly={terminal || status === 'completed' || paymentState === 'unknown'} onBusyChange={onPaymentBusyChange} /></div> : null}
    {flow === 'quote' && data.savedQuote ? <><QuoteBreakdown quote={data.savedQuote.quote} status={data.savedQuote.status} internal={false} /><p className={styles.muted}>Este presupuesto fue aceptado. Los adicionales se deciden por separado.</p></> : null}
    {(flow === 'report' || flow === 'dispute') && data.finalReport ? <><ReportContent report={data.finalReport} photos />{flow === 'report' && canConfirm ? outcomeButtons : null}{flow === 'dispute' && canConfirm ? <form className={styles.form} onSubmit={event => { event.preventDefault(); outcome('disputed') }}><p>Contanos qué no coincide con el resultado. Lysto recibirá el caso para revisarlo.</p><label>Motivo del desacuerdo<textarea maxLength={3000} value={reason} onChange={event => setReason(event.target.value)} required /></label><button className={styles.primaryButton} disabled={blocked || reason.trim().length < 10}>Enviar desacuerdo</button></form> : null}</> : null}
    {flow === 'scope' && data.onsiteDiagnosis ? <section className={styles.section}><dl className={styles.facts}><Fact icon={FileText} label="Diagnóstico presencial">{data.onsiteDiagnosis.actual_diagnosis}</Fact><Fact icon={Wrench} label="Alcance propuesto">{data.onsiteDiagnosis.base_scope}</Fact></dl>{data.onsiteDiagnosis.evidence_ids.length ? <PrivatePhotos ids={data.onsiteDiagnosis.evidence_ids} label="diagnóstico" /> : null}{scopePending ? <div className={styles.form}><p>El presupuesto original no cambia. Cualquier adicional requiere una decisión y un pago separados.</p><button className={styles.primaryButton} disabled={blocked} onClick={() => scopeDecision('accepted')}>Aceptar alcance</button><label>Cambios que necesitás<textarea value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} /></label><button className={styles.secondaryButton} disabled={blocked || reason.trim().length < 10} onClick={() => scopeDecision('changes_requested')}>Pedir cambios</button></div> : null}</section> : null}
    {flow === 'extra' && extra ? <section className={styles.section}><h2>{extra.fault}</h2><p>{extra.description}</p><p className={styles.amount}>{money(extra.amount)}</p><p className={styles.muted}>El presupuesto original no cambia. Si aceptás, el pago de este adicional debe confirmarse antes de iniciar ese alcance.</p>{extra.status === 'proposed' && !terminal ? <div className={styles.inlineActions}>{(['accepted', 'rejected'] as const).map(decision => <button key={decision} disabled={blocked} className={decision === 'accepted' ? styles.primaryButton : styles.secondaryButton} onClick={() => void command('/api/jobs/extras', 'PATCH', `extra:${extra.id}`, { action: 'decide', extraId: extra.id, decision })}>{decision === 'accepted' ? 'Aceptar adicional' : 'Rechazar adicional'}</button>)}</div> : <p className={styles.muted}>La decisión de este adicional ya está registrada.</p>}</section> : null}
  </div>

  let heroTitle = jobStatusLabels[status as JobStatus] ?? 'Servicio en seguimiento'
  let heroCopy = 'El estado se actualiza con la información registrada por Lysto.'
  let primaryFlow: Flow | null = null
  let primaryLabel = ''
  let attention = false
  if (expiredContract) {
    heroTitle = checkouts !== null && paymentState === 'unknown' ? 'Pago por verificar' : initialCheckout?.status === 'review'
      ? 'Pago en revisión' : ['pending', 'in_process'].includes(initialCheckout?.status ?? '') ? 'Pago en proceso'
        : paymentState === 'follow_up' ? 'Pago con seguimiento' : 'Solicitud vencida'
    heroCopy = paymentState === 'approved' ? 'La reserva de la visita venció. El pago está aprobado; consultá la operación antes de coordinar otra visita.'
      : paymentState === 'follow_up' || (checkouts !== null && paymentState === 'unknown')
        ? 'La reserva de la visita venció. El pago requiere seguimiento; no vuelvas a pagar mientras se verifica.'
        : 'La reserva de la visita venció. Podés consultar la información y los movimientos del servicio.'
  }
  else if (terminal) { heroTitle = status.startsWith('cancelled') ? 'Servicio cancelado' : status === 'disputed' ? 'Desacuerdo en revisión' : 'Garantía en seguimiento'; heroCopy = status === 'disputed' ? 'Lysto revisa el caso. El estado se mostrará aquí cuando se actualice.' : status === 'warranty_claim' ? 'Consultá el estado del servicio y las garantías registradas en tu cuenta.' : 'La cancelación quedó registrada. Podés consultar los movimientos disponibles.' }
  else if (canConfirm) { heroTitle = 'Resultado disponible'; heroCopy = 'Revisá el informe antes de confirmar.'; primaryFlow = 'report'; primaryLabel = 'Revisar y confirmar'; attention = true }
  else if (scopePending) { heroTitle = 'Diagnóstico para revisar'; heroCopy = 'El profesional compartió lo encontrado y el alcance propuesto.'; primaryFlow = 'scope'; primaryLabel = 'Revisar diagnóstico y alcance'; attention = true }
  else if (proposedExtras.length) { heroTitle = 'Adicional para revisar'; heroCopy = proposedExtras[0].fault; primaryFlow = 'extra'; primaryLabel = `Revisar adicional: ${proposedExtras[0].fault}`; attention = true }
  else if (status === 'completed') { heroTitle = 'Servicio confirmado'; heroCopy = 'Tu confirmación quedó registrada. Podés consultar el informe y valorar el servicio.' }
  else if (status === 'pending_assignment') { heroTitle = 'Buscando un profesional'; heroCopy = 'Lysto está coordinando la asignación. El pago todavía no está habilitado.' }
  else if (status === 'pending_professional_acceptance') { heroTitle = 'Esperando al profesional'; heroCopy = 'Cuando acepte el servicio, vas a poder realizar el pago.' }
  else if (status === 'confirmed' && checkouts === null) { heroTitle = paymentError ? 'Consultá el estado del pago' : 'Consultando el pago'; heroCopy = paymentError || 'Verificamos el estado registrado antes de mostrar el próximo paso.'; if (paymentError) { primaryFlow = 'payments'; primaryLabel = 'Consultar pagos' } }
  else if (status === 'confirmed' && !paid) { heroTitle = paymentState === 'unknown' ? 'Pago por verificar' : initialCheckout?.status === 'review' ? 'Pago en revisión' : ['pending', 'in_process'].includes(initialCheckout?.status ?? '') ? 'Pago en proceso' : paymentState === 'follow_up' ? 'Pago con seguimiento' : 'Ya podés pagar'; heroCopy = paymentBlocked ? 'Consultá el estado de la operación. No vuelvas a pagar mientras se verifica.' : data.job.contractSource === 'automatic_customer_request' ? 'El profesional está confirmado. El pago se verifica con Mercado Pago.' : 'El profesional aceptó el servicio. El pago se verifica con Mercado Pago.'; primaryFlow = 'payments'; primaryLabel = paymentBlocked ? 'Consultar pagos' : 'Pagar servicio'; attention = !paymentBlocked }
  else if (status === 'confirmed' && paid && data.visit) { heroTitle = 'Visita confirmada'; heroCopy = datePart(data.visit.startsAt, { weekday: 'long', day: 'numeric', month: 'long' }) }
  else if (status === 'confirmed' && paid) { heroTitle = 'Coordinando tu visita'; heroCopy = 'El pago está aprobado. La fecha y el horario todavía no están confirmados.' }
  else if (status === 'technician_on_way') { heroTitle = 'El profesional está en camino'; heroCopy = 'El profesional informó su salida. No hay ubicación en tiempo real disponible.' }
  else if (status === 'arrived') { heroTitle = 'El profesional llegó'; heroCopy = 'La llegada quedó registrada. El siguiente paso es la revisión del equipo.' }
  else if (status === 'onsite_diagnosis') { heroTitle = 'Revisando el equipo'; heroCopy = 'El profesional está preparando el diagnóstico presencial.' }
  else if (status === 'in_progress') { heroTitle = 'Trabajo en curso'; heroCopy = 'El profesional está realizando el alcance aprobado.' }
  else if (status === 'completed_pending_customer_confirmation') { heroTitle = 'Consultando el informe'; heroCopy = 'Todavía no pudimos mostrar el informe necesario para confirmar. Volvé a consultar.' }
  const showVisit = !terminal && status === 'confirmed' && paid && Boolean(data.visit)
  return <div className={styles.detail} ref={root}>
    <Link className={styles.back} href="/app/trabajos"><ArrowLeft size={18} aria-hidden="true" />Servicios</Link>
    <header><h1 className={styles.pageTitle} ref={detailHeading} tabIndex={-1}>{title}</h1><p className={styles.subtitle}>{equipmentName || 'Equipo del servicio'} <span>· #{data.job.id.slice(0, 8)}</span></p></header>
    {reloadNotice}
    <section className={`${styles.hero} ${attention ? styles.attention : ''}`} id="agenda" tabIndex={-1}>
      {attention ? <span className={styles.pill}>{canConfirm ? 'Pendiente de tu confirmación' : 'Requiere tu atención'}</span> : <span className={styles.status}><CheckCircle2 size={19} aria-hidden="true" />{status === 'completed' ? 'Confirmación registrada' : 'Seguimiento del servicio'}</span>}
      <h2>{heroTitle}</h2><p>{heroCopy}</p>
      {showVisit && data.visit ? <p className={styles.visitTime}>{datePart(data.visit.startsAt, { hour: '2-digit', minute: '2-digit', hour12: false })} a {datePart(data.visit.endsAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</p> : null}
      {paid && (!terminal || expiredContract) ? <p className={styles.paid}><CheckCircle2 size={18} aria-hidden="true" />Pago aprobado</p> : null}
      {attention && primaryFlow === 'payments' && data.savedQuote ? <p className={styles.amount}>{money(data.savedQuote.quote.total)}</p> : null}
      {primaryFlow ? <button className={styles.heroAction} disabled={blocked || committed} onClick={event => openFlow(primaryFlow!, event, primaryFlow === 'extra' ? proposedExtras[0]?.id : undefined)}>{primaryLabel}<ArrowRight size={20} aria-hidden="true" /></button> : null}
    </section>
    {message ? <p role="status" className={styles.notice}>{message}</p> : null}
    {paymentError && status !== 'confirmed' ? <p className={styles.notice}>No pudimos consultar los pagos. Podés verificar su estado desde el servicio.</p> : null}
    {data.finalReport ? <ReportContent report={data.finalReport} /> : <section className={styles.section}><h2>{showVisit ? 'Detalles de la visita' : 'Tu solicitud'}</h2><dl className={styles.facts}>{!showVisit ? <Fact icon={Wrench} label="Problema">{issueLabel}</Fact> : null}{equipmentName ? <Fact icon={Monitor} label="Equipo">{equipmentName}</Fact> : null}<Fact icon={MapPin} label="Domicilio">{address ?? 'Domicilio no disponible'}</Fact>{data.job.professionalName || data.visit?.professionalName ? <Fact icon={UserRound} label="Profesional">{data.visit?.professionalName ?? data.job.professionalName}</Fact> : null}{showVisit && data.savedQuote ? <Fact icon={FileText} label="Trabajo previsto">{data.savedQuote.quote.scope}</Fact> : null}</dl></section>}
    <section id="contacto" className={styles.actions} aria-label="Acciones del servicio">
      {scopePending && primaryFlow !== 'scope' ? <button className={styles.actionRow} onClick={event => openFlow('scope', event)}>Revisar diagnóstico y alcance<ChevronRight size={19} aria-hidden="true" /></button> : data.onsiteDiagnosis && !scopePending ? <button className={styles.actionRow} onClick={event => openFlow('scope', event)}>Ver diagnóstico presencial<ChevronRight size={19} aria-hidden="true" /></button> : null}
      {proposedExtras.filter(item => primaryFlow !== 'extra' || item.id !== proposedExtras[0]?.id).map(item => <button key={item.id} className={styles.actionRow} onClick={event => openFlow('extra', event, item.id)}>Revisar adicional: {item.fault}<ChevronRight size={19} aria-hidden="true" /></button>)}
      {data.extras.filter(item => item.status !== 'proposed').map(item => <button key={item.id} className={styles.actionRow} onClick={event => openFlow('extra', event, item.id)}><span>{item.fault}<small>{item.status === 'accepted' ? 'Adicional aceptado' : item.status === 'rejected' ? 'Adicional rechazado' : 'Adicional registrado'} · {money(item.amount)}</small></span><ChevronRight size={19} aria-hidden="true" /></button>)}
      {data.finalReport ? <button className={styles.actionRow} onClick={event => openFlow('report', event)}>Ver informe y fotos<ChevronRight size={19} aria-hidden="true" /></button> : null}
      {canConfirm ? <button className={`${styles.actionRow} ${styles.neutralAction}`} onClick={event => openFlow('dispute', event)}>Informar un desacuerdo<ChevronRight size={19} aria-hidden="true" /></button> : null}
      {data.savedQuote ? <button className={styles.actionRow} onClick={event => openFlow('quote', event)}>Ver presupuesto aceptado<ChevronRight size={19} aria-hidden="true" /></button> : null}
      {primaryFlow !== 'payments' ? <button id="pagos" className={styles.actionRow} onClick={event => openFlow('payments', event)}><span>{beforeVisit && !paid ? 'Consultar pagos' : 'Ver pagos del servicio'}</span><ReceiptText size={19} aria-hidden="true" /></button> : null}
      {status === 'completed' ? <Link className={styles.actionRow} href={`/app/trabajos/${data.job.id}/review`}>Calificar servicio<ChevronRight size={19} aria-hidden="true" /></Link> : null}
      {status === 'completed' || status === 'warranty_claim' ? <Link className={styles.actionRow} href="/app/garantias">Garantías y reclamos<CircleHelp size={19} aria-hidden="true" /></Link> : null}
    </section>
    {canConfirm ? <p className={styles.muted}>Después de confirmar, podés dejar una valoración.</p> : showVisit ? <p className={styles.footnote}><CalendarDays size={17} aria-hidden="true" />Dejá libre el acceso al equipo.</p> : status === 'pending_assignment' || status === 'pending_professional_acceptance' ? <section className={styles.section}><h2>Qué sigue</h2><ol className={styles.nextSteps}><li>Lysto asigna un profesional.</li><li>Cuando acepta, se habilita el pago.</li><li>La visita se confirma con su fecha y horario.</li></ol></section> : null}
  </div>
}
