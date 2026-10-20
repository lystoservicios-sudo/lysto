'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Circle, ClipboardList, Clock3, CreditCard, House, MapPin, MoreHorizontal, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { z } from 'zod'
import { MediaUploader, type SavedPhoto } from '@/components/customer/media-uploader'
import { PaymentPanel } from '@/components/payments/payment-panel'
import { JobCloseoutForm } from '@/components/pro/job-closeout-form'
import { professionalJobContextSchema, type ProfessionalJobContext } from '@/lib/professional/job-context-contract'
import { professionalDefaultView, professionalExtraState, professionalJobCapabilities, professionalJobViews, professionalResultLabels, type ProfessionalJobData, type ProfessionalJobView } from '@/lib/professional/job-workspace-model'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'
import { ProfessionalJobEquipment, ProfessionalJobPhotos } from './job-workspace-media'
import styles from './job-workspace.module.css'

const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const date = (value?: string | null) => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'A coordinar'
  // A calendar date has no instant or UTC offset; keep its original day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00Z`).toLocaleDateString('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' })
}
const statuses: Record<string, string> = { pending_professional_acceptance: 'Propuesta pendiente de tu aceptación', confirmed: 'Visita confirmada', technician_on_way: 'En camino', arrived: 'En el domicilio', onsite_diagnosis: 'Diagnóstico presencial', waiting_customer_approval: 'Esperando al cliente', in_progress: 'Trabajo en curso', completed_pending_customer_confirmation: 'Informe enviado', completed: 'Servicio completado', disputed: 'En revisión', warranty_claim: 'Reclamo en revisión', cancelled: 'Servicio cancelado', cancelled_by_customer: 'Servicio cancelado', cancelled_by_professional: 'Servicio cancelado', cancelled_by_admin: 'Servicio cancelado', refunded: 'Servicio reembolsado' }
const draftSchema = z.object({ jobId: z.string().uuid(), equipmentId: z.string().uuid().nullable(), actor: z.string(), version: z.number(), diagnosis: z.string().max(5000), scope: z.string().max(5000), evidence: z.array(z.string().uuid()).max(5) }).strict()
const validView = (value: string | null): value is ProfessionalJobView => professionalJobViews.includes(value as ProfessionalJobView)
const readView = () => { const value = new URL(window.location.href).searchParams.get('vista'); return validView(value) ? value : null }
class JobReadError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function readJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store', signal })
  if (!response.ok) throw new JobReadError(response.status, response.status === 401 ? 'Tu sesión venció. Volvé a ingresar para continuar.' : response.status === 403 || response.status === 404 ? 'Este trabajo no está disponible para tu cuenta.' : 'No pudimos consultar el trabajo. Intentá nuevamente.')
  return response.json()
}

export function ProfessionalJobWorkspace(props: { jobId?: string; requestId?: string }) {
  return <Workspace key={props.jobId ?? props.requestId} {...props} />
}

function Workspace({ jobId, requestId }: { jobId?: string; requestId?: string }) {
  const [record, setRecord] = useState<{ data: ProfessionalJobData; context: ProfessionalJobContext } | null>(null)
  const [view, setView] = useState<ProfessionalJobView>('summary')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [reportExpanded, setReportExpanded] = useState(false)
  const [diagnosis, setDiagnosis] = useState('')
  const [scope, setScope] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [photos, setPhotos] = useState<SavedPhoto[]>([])
  const [draftReady, setDraftReady] = useState(false)
  const [draftNotice, setDraftNotice] = useState<string | null>(null)
  const [extraForm, setExtraForm] = useState(false)
  const [fault, setFault] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const epoch = useRef(0), initial = useRef(true), alive = useRef(true), locked = useRef(false)
  const recordRef = useRef(record), busyRef = useRef(false), heading = useRef<HTMLDivElement>(null)
  recordRef.current = record; busyRef.current = busy
  const commandController = useRef<AbortController | null>(null)
  const memory = useRef(new Map<string, string>())
  const storage = useRef({
    getItem: (key: string) => { if (memory.current.has(key)) return memory.current.get(key) ?? null; try { return sessionStorage.getItem(key) } catch { return null } },
    setItem: (key: string, value: string) => { memory.current.set(key, value); try { sessionStorage.setItem(key, value) } catch { /* Keep the retry key for this mounted session. */ } },
    removeItem: (key: string) => { memory.current.delete(key); try { sessionStorage.removeItem(key) } catch { /* Memory is already cleared. */ } }
  })

  const load = useCallback(async (chooseView = false) => {
    const generation = ++epoch.current
    const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 20000)
    setRefreshing(true)
    try {
      const raw = await readJson(`/api/pricing/job?${jobId ? `jobId=${encodeURIComponent(jobId)}` : `requestId=${encodeURIComponent(requestId ?? '')}`}`, controller.signal)
      const parsed = z.object({ role: z.literal('professional'), job: z.object({ id: z.string().uuid(), request_id: z.string().uuid().optional(), status: z.string() }).passthrough(), equipmentId: z.string().uuid().nullable(), extras: z.array(z.object({ id: z.string().uuid(), status: z.string(), amount: z.coerce.number().finite(), fault: z.string(), description: z.string() }).passthrough()), onsiteDiagnosis: z.unknown().nullable(), finalReport: z.unknown().nullable() }).passthrough().parse(raw)
      if ((jobId && parsed.job.id !== jobId) || (requestId && parsed.job.request_id !== requestId)) throw new Error('Este trabajo no está disponible para tu cuenta.')
      const result = z.object({ context: professionalJobContextSchema }).parse(await readJson(`/api/pro/jobs/context?jobId=${encodeURIComponent(parsed.job.id)}`, controller.signal))
      if (result.context.jobId !== parsed.job.id || result.context.equipment?.id && result.context.equipment.id !== parsed.equipmentId) throw new Error('No pudimos verificar el equipo de este servicio.')
      if (!alive.current || generation !== epoch.current) return false
      const next = { data: { ...parsed, extras: parsed.extras } as ProfessionalJobData, context: result.context }
      const statusChanged = recordRef.current?.data.job.status !== next.data.job.status || recordRef.current?.data.onsiteDiagnosis?.status !== next.data.onsiteDiagnosis?.status
      setRecord(next); setBlocked(false); setError(null)
      if (initial.current || chooseView || statusChanged) {
        const fallback = professionalDefaultView(next.data)
        let target = initial.current ? readView() ?? fallback : fallback
        if ((target === 'diagnosis' && next.data.onsiteDiagnosis?.status === 'submitted') || (target === 'closeout' && next.data.finalReport)) target = fallback
        if (fallback === 'summary' && !['summary', 'equipment', 'activity', 'payments', 'report', 'extras'].includes(target)) target = fallback
        setView(target); initial.current = false
        const url = new URL(window.location.href); url.searchParams.set('vista', target)
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
      }
      return true
    } catch (failure) {
      if (alive.current && generation === epoch.current && failure instanceof JobReadError && [401, 403, 404].includes(failure.status)) {
        setRecord(null); recordRef.current = null; initial.current = true
        setDiagnosis(''); setScope(''); setEvidence([]); setFiles([]); setPhotos([])
      }
      if (alive.current && generation === epoch.current) { setError(failure instanceof Error && !(failure instanceof z.ZodError) && failure.name !== 'AbortError' ? failure.message : 'No pudimos verificar el estado del servicio. Volvé a consultarlo.'); setBlocked(true) }
      return false
    } finally { window.clearTimeout(timeout); if (alive.current && generation === epoch.current) { setLoading(false); setRefreshing(false) } }
  }, [jobId, requestId])
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; commandController.current?.abort() } }, [load])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && !locked.current && !busyRef.current && !uploadBusy) void load() }
    const timer = window.setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', refresh)
    const pop = () => { if (!locked.current && !uploadBusy) setView(readView() ?? 'summary') }
    window.addEventListener('popstate', pop)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('popstate', pop) }
  }, [load, uploadBusy])
  useEffect(() => {
    if (!loading) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      heading.current?.focus({ preventScroll: true })
    }
  }, [view, loading, reportExpanded])
  const actor = record?.data.job.professional_id ?? ''
  const draftKey = record ? `lysto:professional-diagnosis:${actor}:${record.data.job.id}` : null
  const serverDiagnosis = record?.data.onsiteDiagnosis
  useEffect(() => {
    if (!record || !draftKey) return
    setDraftReady(false); setFiles([]); setPhotos([])
    let draft: z.infer<typeof draftSchema> | null = null
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (raw) { const parsed = draftSchema.parse(JSON.parse(raw)); if (parsed.jobId === record.data.job.id && parsed.equipmentId === record.data.equipmentId && parsed.actor === actor && parsed.version === (serverDiagnosis?.version ?? 0) && !['submitted', 'accepted'].includes(serverDiagnosis?.status ?? '')) draft = parsed }
    } catch { setDraftNotice('El borrador local no está disponible. Podés completar el diagnóstico igualmente.') }
    setDiagnosis(draft?.diagnosis ?? serverDiagnosis?.actual_diagnosis ?? '')
    setScope(draft?.scope ?? serverDiagnosis?.base_scope ?? '')
    setEvidence(draft?.evidence ?? serverDiagnosis?.evidence_ids ?? [])
    setDraftReady(true)
    // Refreshing unrelated payment data must not overwrite a diagnosis being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, actor, serverDiagnosis?.version, serverDiagnosis?.status])
  useEffect(() => {
    if (!draftKey || !record || !draftReady || ['submitted', 'accepted'].includes(serverDiagnosis?.status ?? '')) return
    try { sessionStorage.setItem(draftKey, JSON.stringify({ jobId: record.data.job.id, equipmentId: record.data.equipmentId, actor, version: serverDiagnosis?.version ?? 0, diagnosis, scope, evidence })) }
    catch { setDraftNotice('Tu navegador no permite guardar borradores. No cierres esta pantalla antes de enviar.') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, draftReady, actor, diagnosis, scope, evidence, serverDiagnosis?.version, serverDiagnosis?.status])

  const open = (next: ProfessionalJobView) => {
    if (busy || uploadBusy) return
    setError(null); setMenu(false); setView(next)
    if (next === 'report') setReportExpanded(false)
    const url = new URL(window.location.href); url.searchParams.set('vista', next)
    window.history.pushState(window.history.state, '', url.pathname + url.search + url.hash)
  }
  const command = async (url: string, payload: Record<string, unknown>, commandName: string) => {
    if (!record || locked.current || blocked || uploadBusy) return false
    locked.current = true; setBusy(true); setError(null)
    const commandScope = `professional:${actor}:${record.data.job.id}:${commandName}`
    const controller = new AbortController()
    commandController.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    try {
      const pending = recoverCommand(storage.current, commandScope, JSON.stringify(payload))
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, idempotencyKey: pending.key }), signal: controller.signal })
      const body = await response.json()
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'No pudimos guardar el cambio.')
      acknowledgeCommand(storage.current, commandScope, pending.key)
      await load(true)
      // A confirmed POST must never be offered as a new proposal if only its follow-up read failed.
      return true
    } catch (failure) {
      if (!alive.current) return false
      const message = failure instanceof Error && failure.name !== 'AbortError' ? failure.message : 'No pudimos confirmar el cambio.'
      setBlocked(true)
      const verified = await load()
      if (alive.current) setError(`${message} ${verified ? 'Consultamos el estado actual. Revisalo antes de volver a enviar.' : 'Consultá el estado antes de volver a intentar.'}`)
      return false
    } finally { window.clearTimeout(timeout); commandController.current = null; locked.current = false; if (alive.current) setBusy(false) }
  }

  const nav = <nav aria-label="Navegación profesional" className={styles.bottomNav}>{[
    ['/pro/dashboard', 'Inicio', House], ['/pro/trabajos', 'Trabajos', ClipboardList], ['/pro/agenda', 'Agenda', CalendarDays], ['/pro/pagos', 'Cobros', CreditCard], ['/pro/mas', 'Más', MoreHorizontal]
  ].map(([href, label, Icon]) => { const Symbol = Icon as typeof House; return <Link key={String(href)} href={String(href)} aria-current={label === 'Trabajos' ? 'page' : undefined}><Symbol size={20} aria-hidden="true" /><span>{String(label)}</span></Link> })}</nav>
  if (loading) return <div className={styles.root}><header className={styles.header}><Link href="/pro/trabajos" className={styles.back} aria-label="Volver a trabajos"><ArrowLeft /></Link><p className={styles.jobName}>Detalle del trabajo</p></header><div className={styles.body} role="status"><p>Cargando tu trabajo…</p><div className={styles.skeleton} /></div></div>
  if (!record) return <div className={styles.root} data-focused="false"><div className={styles.body}><h1 className={styles.title}>No pudimos abrir el trabajo</h1><p role="alert" className={styles.errorNotice}>{error}</p><button className={styles.primary} onClick={() => void load()} disabled={refreshing}>Volver a intentar</button><Link className={styles.secondary} href="/pro/trabajos">Volver a trabajos</Link></div>{nav}</div>
  const { data, context } = record
  const extraPayments = new Map(context.extraPayments.map(value => [value.extraId, value.status]))
  const caps = professionalJobCapabilities({ status: data.job.status, initialPaymentStatus: context.initialPaymentStatus, diagnosisStatus: data.onsiteDiagnosis?.status ?? null, extras: data.extras.map(extra => ({ status: extra.status, paymentStatus: extraPayments.get(extra.id) ?? null })), contractSource: data.job.contractSource, requestStatus: data.job.requestStatus })
  const disabled = busy || uploadBusy || blocked || refreshing
  const focused = (view === 'diagnosis' && caps.canDiagnose) || view === 'closeout' || (view === 'extras' && extraForm)
  const readonlyDiagnosis = data.onsiteDiagnosis
  const initialApproved = context.initialPaymentStatus === 'approved'
  const visitAddress = data.visit?.addressLabel ?? data.visitAddressLabel ?? (data.savedQuote?.address ? [data.savedQuote.address.street, data.savedQuote.address.number, data.savedQuote.address.city].filter(Boolean).join(' ') : null)
  const amountValue = Number(data.savedQuote?.quote.customerTotal ?? data.job.final_amount)
  const nextAction = caps.advance ? <button className={styles.primary} disabled={disabled} onClick={() => void command('/api/pricing/job/status', { action: 'advance', jobId: data.job.id, expectedStatus: caps.advance!.expectedStatus }, 'advance')}>{busy ? 'Guardando…' : caps.advance.label}</button> : caps.canDiagnose ? <button className={styles.primary} disabled={disabled} onClick={() => open('diagnosis')}>{readonlyDiagnosis?.status === 'changes_requested' ? 'Corregir diagnóstico' : 'Completar diagnóstico'}</button> : caps.waitingApproval ? <button className={styles.primary} disabled>Esperando aprobación</button> : caps.canClose ? <button className={styles.primary} disabled={disabled} onClick={() => open('closeout')}>Completar informe</button> : data.finalReport ? <button className={styles.primary} onClick={() => open('report')}>Ver informe</button> : null
  const row = (label: string, description: string, target: ProfessionalJobView, Icon = ChevronRight) => <button type="button" aria-label={label} className={styles.rowButton} disabled={busy || uploadBusy} onClick={() => open(target)}><Icon size={20} aria-hidden="true" /><span className={styles.rowCopy}><span className={styles.rowTitle}>{label}</span><span className={styles.rowDescription}>{description}</span></span><ChevronRight size={18} aria-hidden="true" /></button>
  const diagnosisContent = readonlyDiagnosis ? <><section className={styles.section}><h2 className={styles.sectionHeading}>Falla encontrada</h2><p>{readonlyDiagnosis.actual_diagnosis}</p><h2 className={styles.sectionHeading}>Alcance base</h2><p>{readonlyDiagnosis.base_scope}</p>{readonlyDiagnosis.decision_reason ? <p className={styles.notice}>Observación del cliente: {readonlyDiagnosis.decision_reason}</p> : null}</section><ProfessionalJobPhotos ids={readonlyDiagnosis.evidence_ids} label="Fotos del diagnóstico" /></> : <p className={styles.notice}>Todavía no hay un diagnóstico enviado para este servicio.</p>
  const onPhotos = (saved: SavedPhoto[]) => { setPhotos(saved); setEvidence(previous => [...new Set([...previous, ...saved.map(photo => photo.upload.attachmentId)])].slice(0, 5)) }
  const submitDiagnosis = async (event: FormEvent) => {
    event.preventDefault()
    if (!caps.canDiagnose || !data.equipmentId || !evidence.length || files.some(file => !photos.some(photo => photo.file === file))) { setError('Completá los campos y guardá entre 1 y 5 fotos antes de enviar.'); return }
    if (await command('/api/pricing/job/status', { action: 'submitDiagnosis', jobId: data.job.id, expectedStatus: data.job.status, actualDiagnosis: diagnosis.trim(), baseScope: scope.trim(), equipmentId: data.equipmentId, evidenceIds: evidence }, 'diagnosis')) { if (draftKey) { try { sessionStorage.removeItem(draftKey) } catch { /* The submitted diagnosis is on the server. */ } } }
  }
  const submitExtra = async (event: FormEvent) => {
    event.preventDefault()
    const numeric = Number(amount.replace(',', '.'))
    if (!caps.canProposeExtra || !/^\d+(?:[.,]\d{1,2})?$/.test(amount) || numeric <= 0 || numeric > 100000000) { setError('Ingresá un importe válido en pesos, con hasta dos decimales.'); return }
    if (await command('/api/jobs/extras', { action: 'propose', jobId: data.job.id, fault: fault.trim(), description: description.trim(), amount: numeric }, 'extra')) { setExtraForm(false); setFault(''); setDescription(''); setAmount(''); setView('extras') }
  }
  let content: ReactNode
  switch (view) {
    case 'equipment': content = <><ProfessionalJobEquipment key={`${context.home?.id}:${context.equipment?.id}`} context={context} />{!caps.readOnly && (caps.advance || caps.canDiagnose) ? <div className={styles.actionFooter}>{nextAction}</div> : null}</>; break
    case 'diagnosis': content = <><h1 className={styles.title}>Diagnóstico presencial</h1><p className={styles.subtitle}>Registrá lo que encontraste y qué incluye el trabajo base.</p>{caps.canDiagnose ? <form className={styles.form} onSubmit={submitDiagnosis}><fieldset disabled={disabled} className={styles.stack} style={{ border: 0, padding: 0, margin: 0 }}>
      {readonlyDiagnosis?.status === 'changes_requested' ? <p className={styles.notice}>El cliente pidió una corrección. {readonlyDiagnosis.decision_reason}</p> : null}
      <label className={styles.field}>Falla encontrada<textarea className={styles.textarea} required minLength={10} maxLength={5000} value={diagnosis} onChange={event => setDiagnosis(event.target.value)} /></label>
      <label className={styles.field}>Alcance base<textarea aria-label="Alcance base" aria-describedby="base-scope-help" className={styles.textarea} required minLength={10} maxLength={5000} value={scope} onChange={event => setScope(event.target.value)} /><span id="base-scope-help" className={styles.small}>Describí únicamente lo incluido en el servicio contratado.</span></label>
      {evidence.some(id => !photos.some(photo => photo.upload.attachmentId === id)) ? <ProfessionalJobPhotos ids={evidence.filter(id => !photos.some(photo => photo.upload.attachmentId === id))} label="Fotos guardadas del diagnóstico" /> : null}
      {evidence.length < 5 || files.length ? <MediaUploader files={files} onFilesChange={setFiles} savedPhotos={photos} onSavedPhotosChange={onPhotos} onBusyChange={setUploadBusy} maxFiles={Math.max(0, 5 - evidence.filter(id => !photos.some(photo => photo.upload.attachmentId === id)).length)} target={{ kind: 'job-photo', entityId: data.job.id, phase: 'during' }} /> : null}
      <p className={styles.small}>Entre 1 y 5 fotos reales. El diagnóstico enviado queda en consulta hasta la respuesta del cliente.</p>
      {draftNotice ? <p className={styles.notice}>{draftNotice}</p> : null}
      {caps.canProposeExtra ? <button type="button" className={styles.secondary} onClick={() => { setExtraForm(true); open('extras') }}>Preparar un adicional</button> : null}
      <div className={styles.actionFooter}><button type="submit" className={styles.primary} disabled={disabled || !evidence.length || !data.equipmentId}>{busy ? 'Enviando…' : 'Enviar para aprobación'}</button><button type="button" className={styles.secondary} onClick={() => open('summary')}>Volver al detalle</button></div>
    </fieldset></form> : <>{diagnosisContent}<p className={styles.notice}>Este diagnóstico no se puede editar en el estado actual.</p></>}</>; break
    case 'approval': content = <><h1 className={styles.title}>{readonlyDiagnosis?.status === 'submitted' ? 'Diagnóstico enviado' : readonlyDiagnosis?.status === 'accepted' ? 'Alcance aprobado' : 'Diagnóstico y alcance'}</h1><p className={styles.subtitle}>{readonlyDiagnosis?.status === 'submitted' ? 'El cliente revisa el alcance y los adicionales, si los hay. Te avisamos acá cuando podés continuar.' : readonlyDiagnosis ? 'Consultá el alcance registrado y la respuesta del cliente.' : 'Al llegar al domicilio podrás iniciar el diagnóstico y enviar el alcance al cliente.'}</p>{diagnosisContent}{caps.waitingApproval ? <button className={styles.primary} disabled>Esperando aprobación</button> : nextAction}{row('Adicionales', 'Consultá la autorización y el pago por separado.', 'extras')}<button type="button" className={styles.secondary} disabled={disabled} onClick={() => void load(true)}><RefreshCw size={16} aria-hidden="true" />Consultar estado</button></>; break
    case 'extras': content = <><h1 className={styles.title}>{extraForm && caps.canProposeExtra ? 'Proponer un adicional' : 'Adicionales'}</h1><p className={styles.subtitle}>Antes de intervenir: propuesta aceptada y pago aprobado.</p>{extraForm && caps.canProposeExtra ? <form className={styles.form} onSubmit={submitExtra}><fieldset disabled={disabled} className={styles.stack} style={{ border: 0, padding: 0, margin: 0 }}><label className={styles.field}>Problema adicional<input className={styles.input} required minLength={5} maxLength={500} value={fault} onChange={e => setFault(e.target.value)} /></label><label className={styles.field}>Trabajo y repuestos incluidos<textarea className={styles.textarea} required minLength={10} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label><label className={styles.field}>Importe total (ARS)<input className={styles.input} inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} /></label><p className={styles.notice}>Este importe se presenta al cliente por separado del servicio base. No ejecutes el adicional mientras falte su aprobación o su pago.</p><div className={styles.actionFooter}><button className={styles.primary} type="submit" disabled={disabled}>{busy ? 'Enviando…' : 'Enviar propuesta'}</button><button className={styles.secondary} type="button" onClick={() => setExtraForm(false)}>Volver a adicionales</button></div></fieldset></form> : <>{data.extras.length ? data.extras.map(extra => { const state = professionalExtraState(extra.status, extraPayments.get(extra.id) ?? null); return <article key={extra.id} className={styles.section}><div className={styles.metaRow}><h2 className={styles.sectionHeading}>{extra.fault}</h2><strong className={styles.amount}>{money(Number(extra.amount))}</strong></div><p>{extra.description}</p><p className={styles.small}>{extra.status === 'accepted' ? 'Propuesta aceptada' : extra.status === 'proposed' ? 'Propuesta enviada' : 'Propuesta no aceptada'}</p><p className={state.ready ? styles.successNotice : styles.notice}>{state.label}</p></article> }) : <p className={styles.notice}>Este servicio no tiene adicionales.</p>}{caps.canProposeExtra ? <button className={styles.primary} disabled={disabled} onClick={() => setExtraForm(true)}>Proponer adicional</button> : null}<button className={styles.secondary} disabled={disabled} onClick={() => void load()}>Consultar estado</button><button className={styles.secondary} onClick={() => open(caps.canDiagnose ? 'diagnosis' : 'summary')}>{caps.canDiagnose ? 'Volver al diagnóstico' : 'Volver al detalle'}</button></>}</>; break
    case 'work': content = <><span className={styles.statusSuccess}>Alcance {readonlyDiagnosis?.status === 'accepted' ? 'aprobado' : 'por verificar'}</span><h1 className={styles.title}>Trabajo en curso</h1><p className={styles.subtitle}>Trabajá sobre el alcance autorizado y registrá el resultado al terminar.</p>{diagnosisContent}{!caps.canWork ? <p className={styles.notice}>Antes de continuar, verificá el pago inicial, la aprobación del diagnóstico y los adicionales pendientes.</p> : <p className={styles.successNotice}>El trabajo autorizado está habilitado.</p>}{row('Adicionales', `${data.extras.length} propuestas en este servicio`, 'extras')}{nextAction}<button className={styles.secondary} disabled={disabled} onClick={() => void load()}>Consultar estado</button></>; break
    case 'closeout': content = <>{caps.canClose && data.equipmentId ? <JobCloseoutForm jobId={data.job.id} equipmentId={data.equipmentId} actorKey={actor} initialDiagnosis={readonlyDiagnosis?.actual_diagnosis} onBack={() => open('work')} onRefresh={async () => { if (!(await load())) throw new Error('No pudimos verificar el estado del informe.') }} onBusyChange={setBusy} onCompleted={() => void load(true)} /> : <><h1 className={styles.title}>Informe del servicio</h1><p className={styles.notice}>El servicio todavía no está habilitado para cerrar o ya tiene un informe enviado. Consultá el estado actual.</p>{data.finalReport ? <button className={styles.primary} onClick={() => open('report')}>Ver informe enviado</button> : <button className={styles.secondary} disabled={disabled} onClick={() => void load(true)}>Consultar estado</button>}</>}</>; break
    case 'report': content = <>
      <h1 className={styles.title}>{reportExpanded || !data.finalReport ? 'Informe del servicio' : 'Informe enviado'}</h1>
      {data.finalReport ? <>
        {data.job.status === 'completed_pending_customer_confirmation' ? <p className={styles.notice}><Clock3 size={20} aria-hidden="true" />Esperando conformidad del cliente</p> : <p className={styles.status}>{statuses[data.job.status] ?? 'Estado por verificar'}</p>}
        {reportExpanded ? <>
          <p className={styles.subtitle}>{date(data.finalReport.created_at)}</p>
          <section className={styles.report}><p className={styles.statusSuccess}>{professionalResultLabels[data.finalReport.final_state] ?? 'Resultado registrado'}</p><h2 className={styles.sectionHeading}>Diagnóstico</h2><p>{data.finalReport.real_diagnosis}</p><h2 className={styles.sectionHeading}>Trabajo realizado</h2><p>{data.finalReport.work_done}</p><h2 className={styles.sectionHeading}>Repuestos utilizados</h2><p>{data.finalReport.parts_used || 'No se registraron repuestos.'}</p>{data.finalReport.next_maintenance_date ? <p>Próximo mantenimiento recomendado: {data.finalReport.next_maintenance_date}</p> : null}</section>
          <ProfessionalJobPhotos ids={data.finalReport.after_photo_ids} label="Fotos del resultado" />
          <button className={styles.secondary} onClick={() => setReportExpanded(false)}>Volver al resumen</button>
        </> : <>
          <section className={styles.section}><h2 className={styles.sectionHeading}>Resumen del trabajo</h2><ol className={styles.activity}>
            <li className={styles.activityItem}><ClipboardList size={20} aria-hidden="true" /><div className={styles.activityCopy}><strong>Diagnóstico compartido</strong><p>{data.onsiteDiagnosis?.created_at ? date(data.onsiteDiagnosis.created_at) : 'Incluido en el informe'}</p></div><CheckCircle2 size={18} color="#17643a" aria-label="Registrado" /></li>
            <li className={styles.activityItem}><Wrench size={20} aria-hidden="true" /><div className={styles.activityCopy}><strong>Trabajo realizado</strong><p>Resultado registrado</p></div><CheckCircle2 size={18} color="#17643a" aria-label="Registrado" /></li>
            <li className={styles.activityItem}><ClipboardList size={20} aria-hidden="true" /><div className={styles.activityCopy}><strong>Informe enviado</strong><p>{date(data.finalReport.created_at)}</p></div><CheckCircle2 size={18} color="#17643a" aria-label="Enviado" /></li>
            <li className={styles.activityItem}><ShieldCheck size={20} aria-hidden="true" /><div className={styles.activityCopy}><strong>Conformidad del cliente</strong><p>{data.job.status === 'completed' ? 'Confirmada' : data.job.status === 'completed_pending_customer_confirmation' ? 'Pendiente' : 'Consultá el estado del servicio'}</p></div>{data.job.status === 'completed' ? <CheckCircle2 size={18} color="#17643a" aria-label="Confirmada" /> : <Circle size={18} color="#8a98ad" aria-label="Sin confirmación" />}</li>
          </ol></section>
          <button className={styles.rowButton} onClick={() => setReportExpanded(true)}><span className={styles.rowCopy}><span className={styles.rowTitle}>Ver fotos del resultado</span></span><ChevronRight size={18} aria-hidden="true" /></button>
          {row('Cobros del servicio', 'Importes y estado de los pagos.', 'payments', CreditCard)}
          <div className={styles.actionFooter}><button className={styles.primary} onClick={() => setReportExpanded(true)}>Ver informe</button><Link className={styles.secondary} href="/pro/trabajos">Volver a Trabajos</Link></div>
        </>}
      </> : <p className={styles.notice}>Todavía no hay un informe enviado.</p>}
    </>; break
    case 'payments': content = <><h1 className={styles.title}>Cobros del servicio</h1><p className={styles.subtitle}>Movimientos reales del servicio y sus adicionales.</p><PaymentPanel jobId={data.job.id} jobStatus={data.job.status} serviceAmount={Number.isFinite(amountValue) ? amountValue : null} role="professional" extras={data.extras} readOnly={blocked || caps.expired} onBusyChange={setBusy} /></>; break
    case 'activity': content = <><h1 className={styles.title}>Actividad del trabajo</h1><p className={styles.subtitle}>Registros confirmados de este servicio.</p><ol className={styles.activity}>{[[data.job.created_at, 'Trabajo asignado'], [data.onsiteDiagnosis?.created_at, 'Diagnóstico registrado'], [data.finalReport?.created_at, 'Informe enviado']].filter(([timestamp]) => timestamp).map(([timestamp, label]) => <li key={label} className={styles.activityItem}><span className={styles.activityIcon}><Clock3 size={18} aria-hidden="true" /></span><div className={styles.activityCopy}><strong>{label}</strong><p>{date(timestamp)}</p></div></li>)}</ol><p className={styles.notice}>Estado actual: {statuses[data.job.status] ?? 'En revisión'}. Las acciones de visita son manuales; no hay seguimiento de ubicación.</p></>; break
    default: content = <><p className={initialApproved ? styles.successNotice : styles.notice}><ShieldCheck size={18} aria-hidden="true" />{initialApproved ? 'Pago inicial aprobado' : data.job.status === 'pending_professional_acceptance' ? 'Primero revisá y aceptá la propuesta' : 'Esperando el pago del cliente'}</p><h1 className={styles.title}>{context.issueLabel}</h1>
      {data.job.status === 'pending_professional_acceptance' && !caps.expired ? <Link className={styles.primary} href="/pro/solicitudes">Revisar propuesta</Link> : null}
      {caps.expired || caps.readOnly ? <p className={styles.notice}>{caps.expired ? 'La solicitud venció.' : `${statuses[data.job.status] ?? 'Estado por verificar'}.`} Este trabajo está en modo consulta.</p> : null}
      <section className={styles.section} aria-label="Datos de la visita"><div className={styles.meta}><div className={styles.metaRow}><CalendarDays size={18} aria-hidden="true" /><span>{date(data.visit?.startsAt ?? data.job.scheduled_date)}{!data.visit && data.job.scheduled_time_window ? ` · ${data.job.scheduled_time_window}` : ''}</span></div><div className={styles.metaRow}><MapPin size={18} aria-hidden="true" /><span>{visitAddress ?? 'Dirección no disponible'}</span></div>{context.reportedProblem ? <div className={styles.metaRow}><ClipboardList size={18} aria-hidden="true" /><span>{context.reportedProblem}</span></div> : null}</div></section>
      <button type="button" className={styles.rowButton} aria-label={context.equipment?.nickname ?? 'Equipo del servicio'} onClick={() => open('equipment')} disabled={busy || uploadBusy}><Image src="/images/service-request/air-neutral.webp" width={104} height={70} className={styles.thumbnail} alt="Ilustración orientativa del aire acondicionado" /><span className={styles.rowCopy}><span className={styles.rowTitle}>{context.equipment?.nickname ?? 'Equipo del servicio'}</span><span className={styles.rowDescription}>{[context.equipment?.brand, context.equipment?.model, context.equipment?.frigorias ? `${context.equipment.frigorias} frigorías` : null].filter(Boolean).join(' · ') || 'Ubicación, ficha e historial'}</span></span><ChevronRight size={18} aria-hidden="true" /></button>
      {context.requestPhotoIds?.length ? <details className={styles.section}><summary className={styles.rowTitle}>Fotos enviadas por el cliente ({context.requestPhotoIds.length})</summary><ProfessionalJobPhotos ids={context.requestPhotoIds} label="Fotos de la solicitud" /></details> : null}
      {row('Diagnóstico y alcance', readonlyDiagnosis ? 'Ver el diagnóstico y la respuesta del cliente.' : 'Se completa durante la visita.', caps.canDiagnose ? 'diagnosis' : 'approval', ClipboardList)}
      {row('Adicionales', data.extras.length ? `${data.extras.length} propuestas · aprobación y pago` : 'Sin adicionales propuestos', 'extras', Wrench)}
      {context.accessInstructions ? <details className={styles.section}><summary className={styles.rowTitle}>Indicaciones de acceso</summary><p className={styles.quiet}>{context.accessInstructions}</p></details> : null}
      {Number.isFinite(amountValue) && amountValue > 0 ? <div className={styles.ledger}><span>Servicio base</span><strong>{money(amountValue)}</strong></div> : null}
      {row('Cobros del servicio', 'Estado real del pago inicial y los adicionales.', 'payments', CreditCard)}
      {data.finalReport ? row('Informe del servicio', 'Resultado y evidencia enviada al cliente.', 'report') : null}<div className={styles.actionFooter}>{nextAction}{visitAddress && !caps.readOnly ? <a className={styles.secondary} href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(visitAddress)}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><MapPin size={18} aria-hidden="true" />Cómo llegar</a> : null}{!initialApproved && !caps.readOnly ? <button className={styles.secondary} disabled={disabled} onClick={() => void load()}>Consultar pago</button> : null}</div></>
  }
  return <div className={styles.root} data-focused={focused ? 'true' : 'false'} aria-busy={busy || refreshing}>
    <header className={styles.header}>{view === 'summary' ? <Link className={styles.back} aria-label="Volver a trabajos" href="/pro/trabajos" aria-disabled={busy || uploadBusy} onClick={event => { if (busy || uploadBusy) event.preventDefault() }}><ArrowLeft /></Link> : <button className={styles.back} aria-label="Volver al detalle" disabled={busy || uploadBusy} onClick={() => open('summary')}><ArrowLeft /></button>}<p className={styles.jobName}>Trabajo #{data.job.id.slice(0, 8).toUpperCase()}</p><button type="button" className={styles.moreButton} aria-label="Opciones del trabajo" aria-expanded={menu} disabled={busy || uploadBusy} onClick={() => setMenu(value => !value)}><MoreHorizontal /></button></header>
    {menu ? <div className={styles.section}><button className={styles.secondary} disabled={disabled} onClick={() => void load()}>Actualizar trabajo</button><Link className={styles.secondary} href="/pro/soporte">Ayuda con el servicio</Link></div> : null}
    {!focused ? <div className={styles.tabs} role="tablist" aria-label="Secciones del trabajo">{([['summary', 'Detalle'], ['equipment', 'Equipo'], ['activity', 'Actividad']] as const).map(([id, label]) => <button role="tab" aria-selected={view === id} aria-controls="professional-job-panel" className={styles.tab} key={id} disabled={busy || uploadBusy} onClick={() => open(id)}>{label}</button>)}</div> : null}
    <div key={view} ref={heading} tabIndex={-1} id="professional-job-panel" className={styles.body}>
      {error ? <div role="alert" className={styles.errorNotice}><p>{error}</p><button className={styles.secondary} disabled={busy || refreshing} onClick={() => void load()}>Consultar estado</button></div> : null}
      {blocked ? <p className={styles.notice}>Las acciones están pausadas hasta verificar el estado actual del trabajo.</p> : null}
      {content}
    </div>{!focused ? nav : null}
  </div>
}
