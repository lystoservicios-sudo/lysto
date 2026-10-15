'use client'

import Link from 'next/link'
import { isCustomerMotionReduced } from '@/lib/customer/motion-preference'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Clock3, LoaderCircle } from 'lucide-react'
import { useClientFocusedFlow } from '@/components/app-shell/client-flow-context'
import type { SavedPhoto } from '@/components/customer/media-uploader'
import type { CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import type { ServiceIssueSlug } from '@/lib/domain/types'
import { privateRequest, PrivateRequestError, requestError } from '@/lib/http/private-client'
import type { RequestPreviewInput } from '@/lib/customer-requests/contracts'
import { createRequestDraft, getSelectedRequestAnswers, getRequestServiceIssue, getRequestStepErrors, requestDraftReducer, type RequestDraftAction, type RequestLocationSelection, type RequestStep } from './request-draft'
import { listRequestEquipment, resolveRequestContext } from './request-context'
import { argentinaDay, clearPendingPayment, clearRequestDraft, clearRequestPhotos, paymentPresentation, readPendingPayment, readRequestDraft, readRequestPhotos, safeCheckoutUrl, storePendingPayment, storeRequestDraft, storeRequestPhotos, type PendingRequestPayment, type PreparedRequest, type RequestPreview, type RetainedRequestPhoto } from './request-flow-client'
import { airAsset, DetailsScreen, EquipmentRow, IssueScreen, OrientationScreen, ReviewScreen, ScheduleScreen } from './request-screen-parts'
import type { AirTransitionOrigin } from './request-air-transition'
import { RequestLocationStep } from './request-location-step'
import styles from './request-screens.module.css'

const emptyInventory: CustomerHomesSnapshot = { homes: [], addresses: [], equipment: [] }
const steps: RequestStep[] = ['issue', 'location', 'details', 'orientation', 'schedule', 'review', 'payment']
const stepLabels = ['Equipo y problema', 'Ubicación', 'Detalles', 'Orientación', 'Visita', 'Pedido y precio', 'Pago']
type WizardProps = { customerId?: string; initialData?: CustomerHomesSnapshot; initialIssue?: ServiceIssueSlug; initialEquipmentId?: string }
type MediaDraft = { files: File[]; saved: SavedPhoto[]; retained: RetainedRequestPhoto[] }
type Checkout = { id: string; job_id: string; extra_id: string | null; status: string }

/** Remount on identity change: no private draft, request epoch or photo handles cross accounts. */
export function AirConditioningWizard(props: WizardProps) { return <RequestWizard key={props.customerId ?? 'unscoped'} {...props} /> }
function initialDraft(actor: string, data: CustomerHomesSnapshot, initialIssue?: ServiceIssueSlug, initialEquipmentId?: string) {
  const equipment = listRequestEquipment(data)
  const selected = equipment.find(e => e.id === initialEquipmentId) ?? equipment[0]
  let draft = createRequestDraft(actor, selected?.id ?? null)
  if (initialIssue === 'instalacion') draft = requestDraftReducer(draft, { type: 'purpose', purpose: 'installation' })
  else if (initialIssue === 'mantenimiento') draft = requestDraftReducer(draft, { type: 'purpose', purpose: 'maintenance' })
  else if (initialIssue) draft = requestDraftReducer(draft, { type: 'issue', issue: initialIssue })
  const context = resolveRequestContext(data, selected?.id ?? null)
  if (context.kind === 'located') draft = requestDraftReducer(draft, { type: 'location', location: { homeId: context.home.id, addressId: context.address.id, floorId: context.floor.id, roomId: context.room.id, homeVersion: context.home.version } })
  return draft
}
function RequestWizard({ customerId = '', initialData = emptyInventory, initialIssue, initialEquipmentId }: WizardProps) {
  useClientFocusedFlow(true)
  const [data, setData] = useState(initialData)
  const [draft, setDraft] = useState(() => initialDraft(customerId, initialData, initialIssue, initialEquipmentId))
  const [ready, setReady] = useState(false)
  const [preview, setPreview] = useState<RequestPreview | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentCheckBusy, setPaymentCheckBusy] = useState(false)
  const [pending, setPending] = useState<PendingRequestPayment | null>(null)
  const [pendingError, setPendingError] = useState('')
  const [error, setError] = useState('')
  const [locationLocked, setLocationLocked] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [mediaByEquipment, setMediaByEquipment] = useState<Record<string, MediaDraft>>({})
  const [mediaRevision, setMediaRevision] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const latest = useRef({ draft, mediaRevision })
  latest.current = { draft, mediaRevision }
  const alive = useRef(true)
  const previewEpoch = useRef(0)
  const paymentBusyRef = useRef(false)
  const paymentCheckRef = useRef<{ key: string; promise: Promise<void> } | null>(null)
  const pendingRef = useRef<PendingRequestPayment | null>(null)
  const stepRef = useRef<HTMLDivElement>(null)
  const previousStep = useRef(draft.step)
  const heroRef = useRef<HTMLImageElement>(null)
  const [airTransition, setAirTransition] = useState<{ origin: AirTransitionOrigin; src: string; equipmentId: string } | null>(null)
  const transitionDone = useCallback(() => setAirTransition(null), [])
  const answers = getSelectedRequestAnswers(draft)
  const equipmentList = listRequestEquipment(data)
  const equipment = equipmentList.find(e => e.id === draft.selectedEquipmentId) ?? null
  const mediaKey = draft.selectedEquipmentId ?? '$new'
  const media = mediaByEquipment[mediaKey] ?? { files: [], saved: [], retained: [] }
  const stepIndex = steps.indexOf(draft.step)
  const home = data.homes.find(h => h.id === answers.location?.homeId)
  const room = home?.floors.flatMap(f => f.rooms).find(r => r.id === answers.location?.roomId)
  const address = data.addresses.find(a => a.id === answers.location?.addressId)
  const postal = address ? `${address.street} ${address.number}${address.floor ? ` · Piso ${address.floor}` : ''}${address.apartment ? ` · ${address.apartment}` : ''}, ${address.city}` : 'Dirección por completar'
  const locked = paymentBusy || paymentCheckBusy || !!pending || !!pendingError
  const uploaded = !uploadBusy && media.files.length === media.saved.length
  const errors = getRequestStepErrors(draft, draft.step)
  const invalidCharacteristics = answers.characteristics?.capacity !== null && answers.characteristics?.capacity !== undefined && (!Number.isInteger(answers.characteristics.capacity) || answers.characteristics.capacity < 1000 || answers.characteristics.capacity > 30000)
  const invalidDate = draft.step === 'schedule' && !!answers.schedule?.preferredDate && answers.schedule.preferredDate <= argentinaDay()
  const canContinue = ready && !locked && !previewBusy && !locationLocked && !uploadBusy && errors.length === 0 && !invalidDate && !invalidCharacteristics
  const update = useCallback((action: RequestDraftAction) => { setDraft(current => requestDraftReducer(current, action)) }, [])
  const selectLocation = useCallback((location: RequestLocationSelection | null) => update({ type: 'location', location }), [update])
  const lockLocation = useCallback((value: boolean) => setLocationLocked(value), [])

  useEffect(() => {
    const epoch = previewEpoch
    alive.current = true
    if (customerId) {
      const recovered = readPendingPayment(customerId)
      const restored = readRequestDraft(customerId)
      const requestedEquipment = initialData.equipment.find(e => e.id === initialEquipmentId && !e.archivedAt)
      const restorable = restored && (!restored.selectedEquipmentId || initialData.equipment.some(e => e.id === restored.selectedEquipmentId && !e.archivedAt))
      const sameEntry = restorable && (!requestedEquipment || restored.selectedEquipmentId === requestedEquipment.id)
        && (initialIssue === undefined || getRequestServiceIssue(restored) === initialIssue)
      // A changed shortcut starts a new draft; the same URL survives reloads.
      // Neither may supersede an uncertain payment command or its blocking error.
      if ((initialIssue !== undefined || requestedEquipment) && !sameEntry && !recovered.payment && !recovered.error) setDraft(initialDraft(customerId, initialData, initialIssue, initialEquipmentId))
      else if (restorable) setDraft(restored)
      setMediaByEquipment(Object.fromEntries(Object.entries(readRequestPhotos(customerId)).map(([id, retained]) => [id, { files: [], saved: [], retained }])))
      pendingRef.current = recovered.payment; setPending(recovered.payment); setPendingError(recovered.error)
      if (recovered.payment) setDraft(current => ({ ...current, step: recovered.payment?.jobId ? 'payment' : 'review' }))
    }
    setReady(true)
    return () => { alive.current = false; epoch.current++ }
  }, [customerId, initialData, initialIssue, initialEquipmentId])
  useEffect(() => { if (ready && customerId) storeRequestDraft(draft) }, [draft, ready, customerId])
  useEffect(() => {
    if (!ready || !customerId) return
    try { storeRequestPhotos(customerId, Object.fromEntries(Object.entries(mediaByEquipment).map(([id, value]) => [id, [...value.retained, ...value.saved.map(photo => ({ intentId: photo.upload.intentId, name: photo.file.name, bytes: photo.file.size }))]]))) }
    catch (failure) { setError(requestError(failure)) }
  }, [mediaByEquipment, ready, customerId])
  useEffect(() => { previewEpoch.current++; setPreview(null); setPreviewBusy(false) }, [draft.inputRevision, mediaRevision])
  useEffect(() => {
    if (previousStep.current === draft.step) return
    previousStep.current = draft.step
    stepRef.current?.focus({ preventScroll: true }); stepRef.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [draft.step])
  useEffect(() => {
    if (!pending) return
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [pending])
  function changeMedia(value: Partial<MediaDraft>, selected = mediaKey) {
    if (!alive.current) return
    setMediaByEquipment(current => ({ ...current, [selected]: { files: current[selected]?.files ?? [], saved: current[selected]?.saved ?? [], retained: current[selected]?.retained ?? [], ...value } }))
    setMediaRevision(value => value + 1)
  }
  function selectEquipment(id: string | null) {
    if (locked || uploadBusy) return
    update({ type: 'select-equipment', equipmentId: id })
    const context = resolveRequestContext(data, id)
    if (context.kind === 'located') update({ type: 'location', location: { homeId: context.home.id, addressId: context.address.id, floorId: context.floor.id, roomId: context.room.id, homeVersion: context.home.version } })
  }
  function registeredEquipment(id: string) {
    setDraft(current => {
      const answersByEquipment = { ...current.answersByEquipment, [id]: getSelectedRequestAnswers(current) }
      delete answersByEquipment.$new
      return { ...current, selectedEquipmentId: id, answersByEquipment, inputRevision: current.inputRevision + 1, quote: null }
    })
    setMediaByEquipment(current => {
      const updated = { ...current, [id]: current.$new ?? { files: [], saved: [], retained: [] } }
      delete updated.$new
      return updated
    })
  }
  function go(step: RequestStep) { if (!locked && !uploadBusy && !locationLocked) { if (step !== 'location') setAirTransition(null); setError(''); update({ type: 'go-step', step }) } }
  function previewInput(): RequestPreviewInput {
    if (!equipment || !answers.location || !answers.schedule) throw new Error('Completá el equipo, la ubicación y el horario antes de revisar el presupuesto.')
    const issue = answers.purpose === 'repair' ? answers.issue : answers.purpose === 'maintenance' ? 'mantenimiento' : 'instalacion'
    if (!issue) throw new Error('Elegí el problema o servicio antes de revisar el presupuesto.')
    return { equipmentId: equipment.id, expectedEquipmentVersion: equipment.version, addressId: answers.location.addressId, homeId: answers.location.homeId, expectedHomeVersion: answers.location.homeVersion, floorId: answers.location.floorId, roomId: answers.location.roomId, issue, timeSince: answers.details.kind === 'repair' ? answers.details.timeSince ?? 'days' : 'today', description: answers.details.description, answers: answers.details.kind === 'repair' ? { ...(answers.details.frequency ? { frequency: answers.details.frequency } : {}), ...(answers.details.symptomContext ? { symptom_context: answers.details.symptomContext } : {}) } : answers.details.kind === 'maintenance' ? { last_maintenance: answers.details.lastMaintenance ?? 'unknown' } : { installation_type: answers.details.installationType ?? 'unknown' }, preferredDate: answers.schedule.preferredDate, timeWindow: answers.schedule.preferredTimeWindow as RequestPreviewInput['timeWindow'], urgency: answers.schedule.urgency, uploadIntentIds: [...media.retained.map(photo => photo.intentId), ...media.saved.map(photo => photo.upload.intentId)], ...(answers.characteristics ? { equipmentDeclaration: answers.characteristics } : {}) }
  }
  async function calculatePreview() {
    if (locked || uploadBusy || !uploaded || !customerId) return
    const revision = draft.inputRevision, mediaVersion = mediaRevision, epoch = ++previewEpoch.current
    setPreviewBusy(true); setError('')
    const current = () => alive.current && latest.current.draft.actorId === customerId && latest.current.draft.inputRevision === revision && latest.current.mediaRevision === mediaVersion && previewEpoch.current === epoch
    try {
      const result = await privateRequest<RequestPreview>('/api/customer/requests/preview', 'POST', previewInput(), { 'X-Lysto-Customer-Id': customerId })
      if (!current()) return
      setPreview(result)
      if (result.previewId) update({ type: 'quote', quote: { id: result.previewId, actorId: customerId, inputRevision: revision } })
    } catch (failure) { if (current()) setError(requestError(failure)) }
    finally { if (current()) setPreviewBusy(false) }
  }
  function checkPayment(reconcile = false): Promise<void> {
    const active = pendingRef.current
    if (!active?.jobId || !customerId || !alive.current) return Promise.resolve()
    const key = JSON.stringify([customerId, active.commandId, active.jobId, active.checkoutId])
    const flight = paymentCheckRef.current
    if (flight) return flight.key === key ? flight.promise : flight.promise.then(() => checkPayment(reconcile))
    const current = () => alive.current && latest.current.draft.actorId === customerId && pendingRef.current?.commandId === active.commandId && pendingRef.current?.jobId === active.jobId && pendingRef.current?.checkoutId === active.checkoutId
    setPaymentCheckBusy(true); setError('')
    const task: Promise<void> = Promise.resolve().then(async () => {
      try {
        if (!current()) return
        if (reconcile && active.checkoutId) await privateRequest('/api/mercadopago/checkouts', 'POST', { checkoutId: active.checkoutId, action: 'reconcile_return' }, { 'X-Lysto-Customer-Id': customerId })
        if (!current()) return
        const result = await privateRequest<{ checkouts: Checkout[] }>('/api/mercadopago/checkouts?jobId=' + encodeURIComponent(active.jobId!), 'GET', undefined, { 'X-Lysto-Customer-Id': customerId })
        if (!current()) return
        const canonical = result.checkouts.find(c => c.job_id === active.jobId && c.extra_id === null && (!active.checkoutId || c.id === active.checkoutId))
        setPaymentStatus(canonical?.status ?? null)
        if (canonical?.status === 'approved') { clearPendingPayment(customerId); clearRequestDraft(customerId); clearRequestPhotos(customerId) }
      } catch (failure) { if (current()) setError(requestError(failure)) }
      finally {
        if (paymentCheckRef.current?.promise === task) {
          paymentCheckRef.current = null
          if (alive.current) setPaymentCheckBusy(false)
        }
      }
    })
    paymentCheckRef.current = { key, promise: task }
    return task
  }
  useEffect(() => {
    if (draft.step !== 'payment' || !pending?.jobId || paymentBusy) return
    void checkPayment(true)
    // One reconciliation per entry; additional checks are explicit and do not poll a payment provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.step, pending?.jobId, paymentBusy])
  async function pay() {
    if (paymentBusyRef.current || paymentCheckRef.current || uploadBusy || !uploaded || !customerId || pendingError) return
    if (!pendingRef.current && (preview?.status !== 'ready' || !preview.previewId || draft.quote?.id !== preview.previewId)) return
    paymentBusyRef.current = true; setPaymentBusy(true); setError('')
    let command = pendingRef.current
    try {
      if (!command) {
        command = { previewId: preview!.previewId!, commandId: crypto.randomUUID(), jobId: null, checkoutId: null }
        storePendingPayment(customerId, command); pendingRef.current = command; setPending(command)
      }
      if (!command.jobId) {
        const prepared = await privateRequest<PreparedRequest>('/api/customer/requests/prepare', 'POST', { previewId: command.previewId, commandId: command.commandId }, { 'X-Lysto-Customer-Id': customerId })
        if (!alive.current) return
        if (prepared.status === 'ready' && !prepared.jobId) throw new Error('El sistema todavía no confirmó la referencia del pedido. Reintentá el mismo pedido, sin iniciar otro.')
        if (prepared.status !== 'ready') {
          clearPendingPayment(customerId); pendingRef.current = null; setPending(null)
          setPreview({ ...prepared, status: prepared.status === 'price_changed' ? 'needs_review' : prepared.status })
          setError(prepared.message ?? 'Necesitamos volver a comprobar el presupuesto antes de habilitar el pago.')
          return
        }
        if (!prepared.jobId) throw new Error('No pudimos confirmar la referencia del pedido. Reintentá el mismo pedido.')
        const confirmed: PendingRequestPayment = { ...command, jobId: prepared.jobId }
        storePendingPayment(customerId, confirmed); pendingRef.current = confirmed; setPending(confirmed)
        command = confirmed
      }
      if (!command?.jobId) throw new Error('No pudimos recuperar la referencia del servicio.')
      update({ type: 'go-step', step: 'payment' })
      const checkout = await privateRequest<{ checkoutId: string; status: string; initPoint?: string }>('/api/mercadopago/create-preference', 'POST', { jobId: command.jobId }, { 'X-Lysto-Customer-Id': customerId })
      if (!alive.current) return
      command = { ...command, checkoutId: checkout.checkoutId }
      storePendingPayment(customerId, command); pendingRef.current = command; setPending(command)
      if (checkout.status === 'approved') { await checkPayment(); return }
      const url = safeCheckoutUrl(checkout.initPoint)
      if (checkout.status !== 'ready' || !url) throw new Error('No pudimos abrir el pago. Tu pedido está guardado; reintentá el mismo pago o revisá Servicios.')
      window.location.assign(url)
    } catch (failure) {
      if (!alive.current) return
      if (!command?.jobId && failure instanceof PrivateRequestError && failure.status >= 400 && failure.status < 500) { clearPendingPayment(customerId); pendingRef.current = null; setPending(null) }
      setError(requestError(failure))
    } finally { if (alive.current) { paymentBusyRef.current = false; setPaymentBusy(false) } }
  }
  function advance() {
    if (!canContinue) return
    if (draft.step === 'issue' && equipment && resolveRequestContext(data, equipment.id).kind === 'located' && !isCustomerMotionReduced()) {
      const rect = heroRef.current?.getBoundingClientRect()
      if (rect && rect.width > 0 && rect.height > 0) setAirTransition({ origin: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }, src: airAsset(answers.issue, equipment), equipmentId: equipment.id })
    }
    const next = steps[Math.min(stepIndex + 1, steps.length - 1)]
    if (next !== 'location') setAirTransition(null)
    update({ type: 'go-step', step: next })
    if (next === 'review') void calculatePreview()
  }
  const presentation = paymentPresentation(paymentStatus)
  const canPay = preview?.status === 'ready' && !!preview.previewId && draft.quote?.id === preview.previewId && uploaded && !paymentBusy && !paymentCheckBusy && !pendingError && !previewBusy
  const actionLabel = draft.step === 'location' ? 'Continuar con los detalles' : draft.step === 'orientation' ? 'Elegir horario preferido' : draft.step === 'schedule' ? 'Revisar pedido y presupuesto' : 'Continuar'
  return <div className={styles.flow} data-request-flow>
    <div className={styles.toolbar}><button className={styles.back} disabled={locked || uploadBusy || locationLocked || stepIndex === 0} onClick={() => go(steps[Math.max(0, stepIndex - 1)])}><ArrowLeft size={19} aria-hidden />Atrás</button><Link className={styles.textButton} href="/app">Salir</Link></div>
    <div className={styles.progress} tabIndex={-1} ref={stepRef} role="group" aria-label={`Paso ${stepIndex + 1} de 7: ${stepLabels[stepIndex]}`}><div className={styles.progressLabel}><span><strong>Pedir</strong> · Paso {stepIndex + 1} de 7</span><span>{stepLabels[stepIndex]}</span></div><div role="progressbar" aria-label="Progreso de la solicitud" aria-valuemin={1} aria-valuemax={7} aria-valuenow={stepIndex + 1} className={styles.progressTrack}>{steps.map((s, i) => <span key={s} data-active={i <= stepIndex || undefined} />)}</div></div>
    {pendingError && <p role="alert" className={styles.error}>{pendingError}</p>}
    <fieldset disabled={locked || uploadBusy} className={styles.screen} key={draft.step}>
      {draft.step === 'issue' && <IssueScreen imageRef={heroRef} equipment={equipment} equipmentList={equipmentList} answers={answers} onEquipment={selectEquipment} onIssue={issue => update({ type: 'issue', issue })} onPurpose={purpose => update({ type: 'purpose', purpose })} />}
      {draft.step === 'location' && <RequestLocationStep customerId={customerId} data={data} equipmentId={draft.selectedEquipmentId} selection={answers.location} onData={setData} onEquipmentCreated={registeredEquipment} onSelect={selectLocation} onLock={lockLocation} transition={airTransition} onTransitionDone={transitionDone} />}
      {draft.step === 'details' && <DetailsScreen customerId={customerId} equipment={equipment} answers={answers} onDetails={details => update({ type: 'details', details })} characteristics={answers.characteristics} onCharacteristics={characteristics => update({ type: 'characteristics', characteristics })} files={media.files} savedPhotos={media.saved} retainedPhotos={media.retained} onRemoveRetained={intentId => changeMedia({ retained: media.retained.filter(photo => photo.intentId !== intentId) })} onFiles={files => changeMedia({ files, saved: media.saved.filter(p => files.includes(p.file)) })} onSaved={saved => changeMedia({ saved })} onUploadBusy={busy => { if (alive.current) setUploadBusy(busy) }} mediaKey={`${customerId}:${mediaKey}`} />}
      {draft.step === 'orientation' && <OrientationScreen equipment={equipment} answers={answers} onCorrect={() => go('details')} />}
      {draft.step === 'schedule' && <ScheduleScreen equipment={equipment} value={answers.schedule} onChange={schedule => update({ type: 'schedule', schedule })} address={postal} onAddress={() => go('location')} />}
      {draft.step === 'review' && <ReviewScreen equipment={equipment} answers={answers} homeRoom={[home?.name, room?.name].filter(Boolean).join(' · ')} address={postal} preview={preview} busy={previewBusy} onEdit={go} onRetry={() => void calculatePreview()} verifiedPhotos={media.retained.length + media.saved.length} pendingPhotos={media.files.length - media.saved.length} />}
    </fieldset>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {pending && draft.step === 'review' && <div className={styles.note}><p>El pedido está pendiente de confirmar. Reintentar conserva la misma referencia y evita duplicarlo.</p></div>}
    {draft.step === 'payment' && <section className={styles.statusPanel} aria-busy={paymentBusy || paymentCheckBusy}><div className={styles.statusIcon} data-tone={presentation.tone}>{presentation.tone === 'success' ? <Check size={31} aria-hidden /> : <Clock3 size={28} aria-hidden />}</div><h1 className={styles.title}>{presentation.title}</h1><p className={styles.lead}>{presentation.message}</p><EquipmentRow equipment={equipment} /><p className={styles.small}>{pending?.jobId ? `Referencia del servicio: ${pending.jobId}` : 'Tu pago todavía no se confirmó.'}</p><button className={styles.textButton} disabled={paymentBusy || paymentCheckBusy} onClick={() => void checkPayment(true)}>Actualizar estado del pago</button>{(!paymentStatus || paymentStatus === 'ready' || paymentStatus === 'creating') && pending?.jobId && <button className={styles.primary} disabled={paymentBusy || paymentCheckBusy || !!pendingError} onClick={() => void pay()}>{paymentBusy ? 'Preparando el pago…' : 'Continuar el mismo pago'}</button>}<Link className={paymentStatus === 'approved' || (paymentStatus && !['ready', 'creating'].includes(paymentStatus)) ? styles.primary : styles.textButton} href={pending?.jobId ? `/app/trabajos/${pending.jobId}` : '/app/trabajos'}>Ver servicio</Link><Link className={styles.textButton} href="/app/trabajos">Ir a Servicios</Link></section>}
    {draft.step !== 'payment' && <div className={styles.footer}>
      {!errors.length || draft.step === 'orientation' ? null : <p role="status" className={styles.small}>{draft.step === 'issue' ? 'Elegí una opción para continuar.' : draft.step === 'location' ? 'Elegí o completá la ubicación del aire.' : draft.step === 'details' ? 'Completá el dato del servicio para continuar.' : 'Elegí un día y una franja para continuar.'}</p>}
      {invalidCharacteristics && <p role="status" className={styles.error}>Revisá la capacidad declarada: ingresá un número entre 1.000 y 30.000 frigorías o dejalo vacío si no lo sabés.</p>}
      {draft.step === 'review' ? <button className={styles.primary} data-mp-checkout-cta="checkout-pro" disabled={pending ? paymentBusy || !!pendingError : !canPay} onClick={() => void pay()}>{paymentBusy && <LoaderCircle className={styles.spinner} size={18} aria-hidden />}{paymentBusy ? 'Preparando el pago…' : pending ? 'Reintentar el mismo pedido' : 'Pagar con Mercado Pago'}</button> : <button className={styles.primary} disabled={draft.step === 'orientation' ? !ready || locked || uploadBusy : !canContinue} onClick={draft.step === 'orientation' ? () => { update({ type: 'orientation', accepted: true }); go('schedule') } : advance}>{actionLabel}</button>}
      <p className={styles.small}>{draft.step === 'review' ? pending ? 'Reintentar conserva el mismo pedido.' : preview?.status === 'ready' ? 'Te llevaremos a Mercado Pago para completar el pago.' : 'Todavía no se realiza ningún cobro.' : draft.step === 'orientation' ? 'Todavía no hay una visita confirmada.' : 'Tus datos se mantienen al volver atrás.'}</p>
      {!uploaded && draft.step !== 'details' && <p role="status" className={styles.small}>Guardá las fotos seleccionadas antes de continuar con el pago.</p>}
    </div>}
  </div>
}
