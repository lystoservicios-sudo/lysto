'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, CheckCircle2, ChevronRight, Clock3, Copy, FileText, Info, MapPin, Plus, Search, ShieldCheck, Trash2, UserRound, Wrench, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { OnboardingContext } from '@/lib/professional/onboarding-context'
import { onboardingFields, onboardingSchema, type ProfessionalApplication } from '@/lib/professional/onboarding-contracts'
import { requiredAirConditioningTools } from '@/lib/professional/tool-checklist'
import { initialRegistrationStep, latestRegistrationDocument, registrationDocumentStatus, registrationState, registrationSteps, requiredRegistrationDocuments, validateRegistrationStep } from '@/lib/professional/registration-model'
import { privateRequest, PrivateRequestError, requestError } from '@/lib/http/private-client'
import { MediaUploader } from '@/components/customer/media-uploader'
import { ProfessionalPasswordForm } from './professional-password-form'
import { RegistrationPayments, useRegistrationAccount } from './registration-payments'
import { FullAddressCombobox } from '@/components/location/full-address-combobox'
import styles from './professional-registration.module.css'

export const professionalStatusLabels: Record<string, string> = {
  invited: 'Invitado', form_started: 'Borrador', form_submitted: 'Enviado a revisión', under_review: 'En revisión', rejected: 'Requiere correcciones', approved: 'Aprobado', suspended: 'Suspendido', inactive: 'Inactivo'
}
export const documentLabels: Record<string, string> = {
  identity: 'Documento de identidad', identity_front: 'DNI frente', identity_back: 'DNI dorso', license: 'Matrícula', insurance: 'Seguro', tax: 'Constancia fiscal', profile: 'Foto de perfil (documento privado anterior)'
}
const toolLabels: Record<string, string> = {
  vacuum_pump: 'Bomba de vacío', manifold_r410a_r32: 'Manifold R410A / R32', digital_scale: 'Balanza digital', multimeter: 'Multímetro', clamp_meter: 'Pinza amperométrica', leak_detector: 'Detector de fugas', thermometer: 'Termómetro', ladder: 'Escalera', safety_equipment: 'Elementos de seguridad'
}
const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const dayOrder = [1, 2, 3, 4, 5, 6, 0]
const titles = ['Tus datos', 'Tu oficio', 'Dónde trabajás', 'Tus horarios', 'Foto y documentos', 'Revisá tu postulación', 'Vinculá tus cobros']
const subtitles = ['Revisá tus datos y completá lo que falta.', 'Contanos sobre tu experiencia y cómo trabajás.', 'Elegí tus zonas y cómo te trasladás.', 'Indicá cuándo podés atender trabajos.', 'Una foto para tus clientes. Documentos solo para Lysto.', 'Verificá que toda la información sea correcta antes de enviarla.', 'Vinculá tu propia cuenta para recibir el pago de tus trabajos.']
const fieldNames = { firstName: 'Nombre', lastName: 'Apellido', phone: 'Teléfono', dni: 'DNI', cuil: 'CUIL', birthdate: 'Fecha de nacimiento', address: 'Dirección', yearsExperience: 'Años de experiencia', licenseNumber: 'Número de matrícula', licenseEntity: 'Entidad que emite la matrícula', mobilityType: 'Tipo de movilidad', bio: 'Presentación' } as const
const sameFields = (a: ProfessionalApplication, b: ProfessionalApplication) => JSON.stringify(onboardingFields.strip().parse(a)) === JSON.stringify(onboardingFields.strip().parse(b))

function DocumentUpload({ professionalId, documentType, onSaved, onBusy, onPending }: { professionalId: string; documentType: string; onSaved: () => void; onBusy: (busy: boolean) => void; onPending:(pending:boolean)=>void }) {
  const [files, setFiles] = useState<File[]>([])
  return <div className={styles.documentUpload}><MediaUploader files={files} onFilesChange={(files) => {setFiles(files); onPending(files.length > 0)}} maxFiles={1}
    target={{ kind: 'professional-document', entityId: professionalId, documentType, scope: 'professional-onboarding' }}
    onBusyChange={onBusy} onSavedPhotosChange={(saved) => { if (saved.length) { onPending(false); onSaved() } }}
    labels={{ title: 'Adjuntar documento', description: 'Elegí una foto legible del documento completo.', add: 'Elegir archivo', save: 'Guardar documento' }} /></div>
}

// A different authenticated identity remounts the complete form and invalidates late responses.
export function ConnectedProfessionalOnboarding({ initial }: { initial: OnboardingContext }) {
  return <Registration key={initial.application.professionalId} initial={initial} />
}

function Registration({ initial }: { initial: OnboardingContext }) {
  const router = useRouter()
  const [context, setContext] = useState(initial)
  const [draft, setDraft] = useState(initial.application)
  const [step, setStep] = useState(() => initialRegistrationStep(initial))
  const [direction, setDirection] = useState('forward')
  const [returnToReview, setReturnToReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [denied, setDenied] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [search, setSearch] = useState('')
  const [day, setDay] = useState(1)
  const [copyDays, setCopyDays] = useState<number[]>([])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [replacing, setReplacing] = useState<string[]>([])
  const [pendingDocuments, setPendingDocuments] = useState<string[]>([])
  const [documentUrl, setDocumentUrl] = useState<{ id: string; url: string } | null>(null)
  const [viewApplication, setViewApplication] = useState(false)
  const [locationProof, setLocationProof] = useState('')
  const mounted = useRef(true)
  const locked = useRef(false)
  const readEpoch = useRef(0)
  const editRevision = useRef(0)
  const backgroundReading = useRef(false)
  const activeUploads = useRef(new Set<string>())
  const heading = useRef<HTMLHeadingElement>(null)
  const snapshot = useRef({ context, draft, busy, uploading, pendingAssets: !!avatarFile || pendingDocuments.length > 0 })
  snapshot.current = { context, draft, busy, uploading, pendingAssets: !!avatarFile || pendingDocuments.length > 0 }
  const restricted = ['suspended', 'inactive', 'invited'].includes(context.application.status)
  const account = useRegistrationAccount(!restricted && !denied ? draft.professionalId : '')
  const state = registrationState(context, account.account)
  const editable = ['form_started', 'rejected'].includes(context.application.status)
  const dirty = JSON.stringify(draft) !== JSON.stringify(context.application)
  const pendingAssets = !!avatarFile || pendingDocuments.length > 0
  const disabled = !hydrated || busy || uploading || conflict
  const isForm = editable || step === 6 && (state === 'linking' || state === 'unavailable') || viewApplication

  useEffect(() => { mounted.current = true; setHydrated(true); return () => { mounted.current = false } }, [])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [step, isForm])
  useEffect(() => {
    if (!avatarFile || typeof URL.createObjectURL !== 'function') { setAvatarPreview(null); return }
    const url = URL.createObjectURL(avatarFile); setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])
  useEffect(() => {
    if (!documentUrl) return
    const timer = window.setTimeout(() => setDocumentUrl(null), 55_000)
    return () => window.clearTimeout(timer)
  }, [documentUrl])
  useEffect(() => {
    if (!dirty && !pendingAssets) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, pendingAssets])

  function fail(failure: unknown) {
    if (!mounted.current) return
    if (failure instanceof PrivateRequestError && [401, 403, 404].includes(failure.status)) { setDenied(true); setDocumentUrl(null); setAvatarFile(null) }
    if (failure instanceof PrivateRequestError && failure.status === 409) setConflict(true)
    setError(requestError(failure))
  }
  async function readback(replace = false) {
    const ticket = ++readEpoch.current
    const revision = editRevision.current
    const started = snapshot.current
    const next = await privateRequest<OnboardingContext>('/api/professional/onboarding/context')
    if (!mounted.current || ticket !== readEpoch.current) return null
    if (next.application.professionalId !== initial.application.professionalId) { setDenied(true); throw new Error('Tu sesión cambió. Volvé a ingresar.') }
    if (next.legal?.termsVersion !== started.context.legal?.termsVersion || next.legal?.privacyVersion !== started.context.legal?.privacyVersion) setAccepted(false)
    setContext(next)
    const editedDuringRead = editRevision.current !== revision
    if (editedDuringRead && next.application.version !== started.draft.version) {
      setConflict(true); setError('La información guardada cambió mientras editabas. Revisá la versión guardada antes de continuar.')
    } else if (replace && !editedDuringRead) setDraft(next.application)
    else setDraft((current) => ({ ...current, version: next.application.version, status: next.application.status }))
    if (next.application.status !== started.context.application.status) {
      setStep(initialRegistrationStep(next)); setViewApplication(false); setReturnToReview(false)
    }
    return next
  }
  // Never poll over a local draft. Recheck readonly review/readiness after returning to the app.
  useEffect(() => {
    const refresh = () => {
      const current = snapshot.current
      if (document.visibilityState === 'hidden' || current.busy || current.uploading || current.pendingAssets || locked.current || backgroundReading.current || denied || JSON.stringify(current.context.application) !== JSON.stringify(current.draft)) return
      backgroundReading.current = true
      void readback(true).catch(fail).finally(() => { backgroundReading.current = false })
      void account.refresh()
    }
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
    // Listener reads the latest draft through snapshot; rebind only for authenticated state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied, context.application.status])

  function navigate(next: number) {
    setDirection(next < step ? 'back' : 'forward'); setStep(next); setError(''); setErrors({}); setMessage(''); setDocumentUrl(null)
  }
  function update<K extends keyof ProfessionalApplication>(key: K, value: ProfessionalApplication[K]) {
    ++editRevision.current
    setDraft((current) => ({ ...current, [key]: value })); setMessage(''); setAccepted(false)
    setErrors((current) => { const next = { ...current }; delete next[key]; return next })
  }
  async function save(next: number | 'exit', validate = true) {
    if (locked.current || disabled || pendingAssets || !editable) return
    const invalid = validate ? validateRegistrationStep(step, draft, context) : {}
    setErrors(invalid); setError(''); setMessage('')
    if (Object.keys(invalid).length) { requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return }
    locked.current = true; setBusy(true)
    ++readEpoch.current
    try {
      const fields = onboardingFields.strip().safeParse(draft)
      if (!fields.success) throw new Error('Revisá los datos y los horarios antes de guardar.')
      let acknowledged = context.application
      if (!sameFields(draft, context.application)) {
        const saved = onboardingSchema.parse(await privateRequest<ProfessionalApplication>('/api/professional/onboarding', 'POST', { ...fields.data, expectedVersion: draft.version }))
        acknowledged = { ...saved, address: context.application.address ?? '' }
        if (!mounted.current) return
        setContext((current) => ({ ...current, application: acknowledged })); setDraft((current) => ({ ...current, version: saved.version, status: saved.status }))
      }
      if ((draft.address ?? '') !== (acknowledged.address ?? '')) {
        const savedAddress = onboardingSchema.parse(await privateRequest<ProfessionalApplication>('/api/professional/onboarding/address', 'POST', { address: draft.address, locationProof, expectedVersion: acknowledged.version }))
        acknowledged = { ...savedAddress, address: savedAddress.address ?? draft.address ?? '' }
        if (!mounted.current) return
        setContext((current) => ({ ...current, application: acknowledged })); setDraft(acknowledged)
      }
      const fresh = await readback(true)
      if (!fresh) return
      if (!['form_started', 'rejected'].includes(fresh.application.status)) {
        navigate(initialRegistrationStep(fresh)); return
      }
      if (next === 'exit') router.replace('/pro/dashboard')
      else {
        const currentErrors = validateRegistrationStep(step, fresh.application, fresh)
        if (Object.keys(currentErrors).length) { setErrors(currentErrors); return }
        setReturnToReview(false); navigate(next); setMessage('Cambios guardados')
      }
    } catch (failure) { fail(failure) }
    finally { locked.current = false; if (mounted.current) setBusy(false) }
  }
  async function refresh(discard = false) {
    if (locked.current || uploading) return
    locked.current = true; setBusy(true); setError('')
    try { await readback(discard || !dirty); setConflict(false); setMessage('Información actualizada') } catch (failure) { fail(failure) }
    finally { locked.current = false; if (mounted.current) setBusy(false) }
    await account.refresh()
  }
  async function submit() {
    if (locked.current || disabled || !accepted || !context.legal || dirty) return
    const invalid = validateRegistrationStep(5, draft, context)
    setErrors(invalid); if (Object.keys(invalid).length) return
    locked.current = true; setBusy(true); setError('')
    ++readEpoch.current
    try {
      const submitted = onboardingSchema.parse(await privateRequest('/api/professional/onboarding/submit', 'POST', { expectedVersion: draft.version, accepted: true, termsVersion: context.legal.termsVersion, privacyVersion: context.legal.privacyVersion }))
      if (!mounted.current) return
      // Even if the follow-up read is lost, an acknowledged submission must not be sent twice.
      const saved = { ...submitted, address: submitted.address ?? draft.address }
      setContext((current) => ({ ...current, application: saved })); setDraft(saved); setAccepted(false); navigate(6)
      await readback(true)
      await account.refresh()
    } catch (failure) { fail(failure) }
    finally { locked.current = false; if (mounted.current) setBusy(false) }
  }
  async function openDocument(id: string) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(''); setDocumentUrl(null)
    try {
      const result = await privateRequest<{ url: string }>('/api/professional/onboarding/documents/read', 'POST', { intentId: id })
      if (!['https:', 'http:'].includes(new URL(result.url).protocol)) throw new Error('No pudimos abrir el documento.')
      if (mounted.current) setDocumentUrl({ id, url: result.url })
    } catch (failure) { fail(failure) } finally { locked.current = false; if (mounted.current) setBusy(false) }
  }
  function documentBusy(type: string, value: boolean) {
    if (value) activeUploads.current.add(type); else activeUploads.current.delete(type)
    setUploading(activeUploads.current.size > 0)
  }
  async function uploadAvatar() {
    if (!avatarFile || locked.current || disabled) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(avatarFile.type) || avatarFile.size < 1 || avatarFile.size > 2 * 1024 * 1024) { setError('Usá una foto JPG, PNG o WebP de hasta 2 MB.'); return }
    locked.current = true; setUploading(true); setError('')
    ++readEpoch.current
    try {
      const response = await fetch('/api/professional/onboarding/avatar', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': avatarFile.type }, body: avatarFile, signal: AbortSignal.timeout(30_000) })
      if ([401, 403, 404].includes(response.status)) throw new PrivateRequestError('Tu sesión terminó. Volvé a ingresar.', response.status)
      if (!response.ok) throw new Error('No pudimos guardar la foto. Intentá nuevamente.')
      await readback(false)
      if (mounted.current) { setAvatarFile(null); setMessage('Foto de perfil guardada') }
    } catch (failure) { fail(failure) } finally { locked.current = false; if (mounted.current) setUploading(activeUploads.current.size > 0) }
  }
  function field(key: keyof typeof fieldNames, type = 'text', extra?: ReactNode) {
    const id = `registration-${key}`
    return <label className={styles.field} htmlFor={id} key={key}><span>{fieldNames[key]}</span>
      <input id={id} type={type} required value={draft[key] ?? ''} maxLength={key === 'address' ? 200 : 100}
        inputMode={['phone', 'dni', 'cuil'].includes(key) ? 'numeric' : undefined} autoComplete={key === 'firstName' ? 'given-name' : key === 'lastName' ? 'family-name' : key === 'phone' ? 'tel' : key === 'address' ? 'street-address' : key === 'birthdate' ? 'bday' : undefined}
        min={type === 'number' ? 0 : undefined} max={type === 'number' ? 80 : type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
        aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${id}-error` : undefined}
        onChange={(event) => update(key, (type === 'number' ? Number(event.target.value) : event.target.value) as never)} />
      {errors[key] && <small id={`${id}-error`} className={styles.fieldError}>{errors[key]}</small>}{extra}</label>
  }
  function addressField() {
    const id = 'registration-address'
    return <><FullAddressCombobox id={id} label="Dirección" value={draft.address ?? ''} disabled={disabled}
      className={styles.field}
      ariaInvalid={!!errors.address} ariaDescribedBy={`${id}-hint${errors.address ? ` ${id}-error` : ''}`}
      onChange={(value) => { setLocationProof(''); update('address', value) }}
        onSelectionStart={() => setLocationProof('')}
      onResolved={({ value, proof }) => { setLocationProof(proof); update('address', value) }} />
      <p id={`${id}-hint`} className={styles.hint}>Escribí calle y número y elegí la opción que corresponda a tu localidad y provincia. Si hay muchas coincidencias, podés agregar la localidad para afinar la búsqueda.</p>
      {errors.address && <small id={`${id}-error`} className={styles.fieldError}>{errors.address}</small>}</>
  }
  function groupError(key: string) { return errors[key] ? <p className={styles.fieldError} role="alert">{errors[key]}</p> : null }
  const requiredDocuments = requiredRegistrationDocuments(context)
  const expiryDocuments = context.requirements?.policies.flatMap((policy) => policy.expiryDocuments) ?? []
  const summary = [
    { icon: UserRound, title: 'Tus datos', value: `${draft.firstName} ${draft.lastName} · ${draft.phone}`, detail: draft.address },
    { icon: Wrench, title: 'Tu oficio', value: context.catalog.categories.filter((item) => draft.categoryIds.includes(item.id)).map((item) => item.name).join(', '), detail: `${draft.yearsExperience} años de experiencia · Matrícula ${draft.licenseNumber}` },
    { icon: MapPin, title: 'Dónde trabajás', value: context.catalog.zones.filter((item) => draft.zoneIds.includes(item.id)).map((item) => item.name).join(', '), detail: draft.hasMobility ? `Movilidad: ${draft.mobilityType}` : 'Sin movilidad propia' },
    { icon: Clock3, title: 'Tus horarios', value: `${draft.availability.length} franjas semanales`, detail: dayOrder.filter((day) => draft.availability.some((slot) => slot.weekday === day)).map((day) => weekdays[day]).join(', ') },
    { icon: FileText, title: 'Foto y documentos', value: `${requiredDocuments.filter((type) => latestRegistrationDocument(context, type)).length} documentos cargados`, detail: context.avatarUrl ? 'Foto de perfil guardada' : 'Falta la foto de perfil' }
  ]
  const statusCopy = {
    review: ['Postulación en revisión', 'Recibimos tu postulación. Consultá el resultado desde este espacio.'],
    ready: ['Ya podés recibir trabajos', 'Tu espacio de trabajo ya está disponible.'],
    approved_pending: ['Tu revisión fue aprobada', 'Todavía hay requisitos pendientes para recibir trabajos.'],
    suspended: ['Tu cuenta está suspendida', 'Contactá a Lysto para conocer los próximos pasos.'],
    inactive: ['Tu cuenta está inactiva', 'Si querés retomar tu actividad, contactá a Lysto.'],
    unavailable: ['No pudimos verificar tu alta', 'Tus datos siguen guardados. Actualizá la información para volver a comprobar el estado.']
  } as const

  if (denied) return <div className={styles.root}><section className={styles.final}><ShieldCheck /><h1>Volvé a ingresar</h1><p>La sesión terminó o ya no tiene acceso a esta postulación.</p><Link className={styles.primary} href="/equipo/login?next=%2Fpro%2Fonboarding">Ingresar de nuevo</Link></section></div>
  return <div className={styles.root} aria-busy={busy}>
    <header className={styles.header}>
      <button type="button" className={styles.iconButton} aria-label="Volver" disabled={disabled || pendingAssets} onClick={() => { if (viewApplication) setViewApplication(false); else if (!editable) router.replace('/pro/dashboard'); else if (step > 0) navigate(step - 1); else void save('exit', false) }}><ArrowLeft aria-hidden="true" /></button>
      <span>Tu alta en Lysto</span>
      {editable ? <button type="button" disabled={disabled || pendingAssets} className={styles.textButton} onClick={() => void save('exit', false)}>Guardar y salir</button> : pendingAssets ? <span className={styles.hint}>Foto sin guardar</span> : <Link className={styles.textButton} href="/pro/dashboard">Mi panel</Link>}
    </header>
    {isForm && <>
      <nav aria-label="Pasos de la postulación" className={styles.progress}>
        <div role="progressbar" aria-label="Paso actual de la postulación" aria-valuemin={1} aria-valuemax={7} aria-valuenow={step + 1} className={styles.segments}>
          {registrationSteps.map((label, index) => <button key={label} title={label} aria-label={`Paso ${index + 1}: ${label}`} aria-current={index === step ? 'step' : undefined} data-complete={index <= step} disabled={disabled || pendingAssets || index > step || dirty || !editable || index === 6} onClick={() => navigate(index)} />)}
        </div><p>Paso {step + 1} de 7</p>
      </nav>
      <section key={step} data-direction={direction} className={styles.content}>
        <h1 ref={heading} tabIndex={-1}>{titles[step]}</h1><p className={styles.subtitle}>{subtitles[step]}</p>
        {context.application.status === 'rejected' && <div className={styles.notice} data-tone="warning"><Info aria-hidden="true" /><div><strong>Necesitamos una corrección</strong><p>{context.decisionReason || 'Revisá los datos y documentos observados.'}</p><small>Tu información anterior sigue guardada.</small></div></div>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {conflict && <button className={styles.secondary} disabled={busy} onClick={() => void refresh(true)}>Descartar mis cambios y recargar la versión guardada</button>}
        <form id="registration-form" noValidate onSubmit={(event) => { event.preventDefault(); if (step === 5) void submit(); else void save(returnToReview ? 5 : Math.min(step + 1, 5)) }}>
          <fieldset disabled={disabled || !editable && step !== 4 && step !== 5} className={styles.fields}>
            <legend className={styles.srOnly}>{titles[step]}</legend>
            {step === 0 && <><div className={styles.columns}>{field('firstName')}{field('lastName')}{field('phone', 'tel')}{field('dni')}</div>
              {field('cuil')}{field('birthdate', 'date')}{addressField()}
              <p className={styles.hint}>Correo de tu invitación: {draft.email}</p></>}
            {step === 1 && <>
              <fieldset className={styles.options}><legend>Especialidad</legend>
                {context.catalog.categories.length ? context.catalog.categories.map((item) => <label className={styles.option} key={item.id}><input type="checkbox" checked={draft.categoryIds.includes(item.id)} onChange={(event) => update('categoryIds', event.target.checked ? [...draft.categoryIds, item.id] : draft.categoryIds.filter((id) => id !== item.id))} />{item.name.toLocaleLowerCase('es').includes('aire') && <Image src="/images/service-request/air-neutral.webp" alt="" width={72} height={48} className={styles.specialtyImage} />}<span>{item.name}</span></label>) : <p>No hay especialidades disponibles. Actualizá o contactá a Lysto.</p>}
              </fieldset>{groupError('categoryIds')}
              {draft.categoryIds.filter(id => !context.catalog.categories.some(category => category.id === id)).map((id, index) => <div key={id} className={styles.notice} data-tone="warning"><span>Una especialidad seleccionada ya no está disponible.</span><button type="button" className={styles.textButton} aria-label={`Quitar especialidad no disponible ${index + 1}`} onClick={() => update('categoryIds', draft.categoryIds.filter(value => value !== id))}>Quitar</button></div>)}
              {field('yearsExperience', 'number')}{field('licenseNumber')}{field('licenseEntity')}
              <label className={styles.field}><span id="registration-bio-label">Presentación</span><textarea aria-labelledby="registration-bio-label" aria-describedby="registration-bio-help" rows={3} maxLength={2000} value={draft.bio} onChange={(event) => update('bio', event.target.value)} /><small id="registration-bio-help">Opcional · Contales a tus clientes sobre tu trabajo.</small></label>
              <details className={styles.details}><summary>Herramientas disponibles <span>{draft.tools.length} seleccionadas</span></summary>
                {requiredAirConditioningTools.map((tool) => <label className={styles.option} key={tool}><input type="checkbox" checked={draft.tools.includes(tool)} onChange={(event) => update('tools', event.target.checked ? [...draft.tools, tool] : draft.tools.filter((value) => value !== tool))} /><span>{toolLabels[tool]}</span></label>)}
              </details>{groupError('tools')}
              {context.requirements?.policies.filter((policy) => draft.categoryIds.includes(policy.categoryId)).map((policy) => <p key={policy.categoryId} className={styles.hint}>Experiencia mínima: {policy.minExperience} años.{policy.requiredTools.length ? ` Herramientas requeridas: ${policy.requiredTools.map((tool) => toolLabels[tool] ?? tool).join(', ')}.` : ''}</p>)}
            </>}
            {step === 2 && <>
              <label className={styles.field}><span>Buscar zona</span><div className={styles.search}><Search aria-hidden="true" /><input type="search" value={search} placeholder="Buscá una zona" onChange={(event) => setSearch(event.target.value)} /></div></label>
              <div><p className={styles.hint}>Zonas seleccionadas ({draft.zoneIds.length})</p><div className={styles.chips}>{draft.zoneIds.map((id) => <button key={id} type="button" aria-label={`Quitar ${context.catalog.zones.find((zone) => zone.id === id)?.name ?? 'zona no disponible'}`} onClick={() => update('zoneIds', draft.zoneIds.filter((value) => value !== id))}>{context.catalog.zones.find((zone) => zone.id === id)?.name ?? 'Zona no disponible'}<X aria-hidden="true" /></button>)}</div></div>
              <fieldset className={styles.options}><legend className={styles.srOnly}>Zonas de trabajo</legend>{context.catalog.zones.filter((zone) => zone.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map((zone) => <label key={zone.id} className={styles.option}><input type="checkbox" checked={draft.zoneIds.includes(zone.id)} onChange={(event) => update('zoneIds', event.target.checked ? [...draft.zoneIds, zone.id] : draft.zoneIds.filter((value) => value !== zone.id))} /><span>{zone.name}</span></label>)}</fieldset>
              {!context.catalog.zones.length && <p>No hay zonas disponibles. Actualizá o contactá a Lysto.</p>}{search && !context.catalog.zones.some((zone) => zone.name.toLowerCase().includes(search.toLowerCase())) && <p>No encontramos esa zona. Probá con otro nombre.</p>}{groupError('zoneIds')}
              <p className={styles.hint}>Podés elegir más de una zona.</p>
              <div className={styles.divider}><label className={styles.option}><span><strong>Movilidad</strong><small>Tengo movilidad propia</small></span><input type="checkbox" role="switch" checked={draft.hasMobility} onChange={(event) => update('hasMobility', event.target.checked)} /></label></div>
              {draft.hasMobility && field('mobilityType')}
            </>}
            {step === 3 && <>
              <div className={styles.days} role="group" aria-label="Día a configurar">{dayOrder.map((value) => <button type="button" key={value} aria-pressed={day === value} data-available={draft.availability.some((slot) => slot.weekday === value)} onClick={() => { setDay(value); setCopyDays([]) }}>{weekdays[value].slice(0, 3)}</button>)}</div>
              <h2>{weekdays[day]}</h2>
              {draft.availability.map((slot, index) => slot.weekday === day && <div className={styles.timeRow} key={index}>
                {(['startTime', 'endTime'] as const).map((key) => <label className={styles.field} key={key}><span>{key === 'startTime' ? 'Desde' : 'Hasta'} {index + 1}</span><input type="time" value={slot[key]} onChange={(event) => update('availability', draft.availability.map((value, i) => i === index ? { ...value, [key]: event.target.value } : value))} /></label>)}
                <button type="button" className={styles.iconButton} aria-label={`Quitar horario ${index + 1}`} onClick={() => update('availability', draft.availability.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" /></button>
              </div>)}
              {!draft.availability.some((slot) => slot.weekday === day) && <p className={styles.hint}>Sin horarios para este día.</p>}
              <button type="button" className={styles.inlineButton} disabled={draft.availability.length >= 50} onClick={() => update('availability', [...draft.availability, { weekday: day, startTime: '09:00', endTime: '17:00' }])}><Plus aria-hidden="true" />Agregar horario</button>{groupError('availability')}
              <div className={styles.divider}><h3>Aplicar estos horarios a otros días</h3><p className={styles.hint}>Reemplazá los horarios de los días que selecciones por los de {weekdays[day]}.</p>
                <div className={styles.copyDays}>{dayOrder.filter((value) => value !== day).map((value) => <label key={value}><input type="checkbox" checked={copyDays.includes(value)} onChange={(event) => setCopyDays(event.target.checked ? [...copyDays, value] : copyDays.filter((item) => item !== value))} />{weekdays[value].slice(0, 3)}</label>)}</div>
                <button type="button" className={styles.secondary} disabled={!copyDays.length || !draft.availability.some((slot) => slot.weekday === day)} onClick={() => {
                  const copied = draft.availability.filter((slot) => !copyDays.includes(slot.weekday)).concat(copyDays.flatMap((weekday) => draft.availability.filter((slot) => slot.weekday === day).map((slot) => ({ ...slot, weekday }))))
                  if (copied.length > 50) { setErrors({ availability: 'Podés guardar hasta 50 franjas semanales.' }); return }
                  update('availability', copied); setCopyDays([])
                }}><Copy aria-hidden="true" />Copiar horarios</button>
              </div><p className={styles.hint}>Podés cargar más de una franja por día.</p>
            </>}
            {step === 4 && <>
              <section className={styles.avatarSection} aria-label="Foto de perfil"><div className={styles.avatar}>{avatarPreview || context.avatarUrl ? <Image unoptimized src={avatarPreview || context.avatarUrl || ''} alt="Foto de perfil del profesional" width={88} height={88} /> : <UserRound aria-hidden="true" />}</div><div><h2>Foto de perfil</h2><p className={styles.hint}>La ven los clientes. No subas tu DNI aquí.</p>{(editable || context.application.status === 'approved') && <label className={styles.inlineButton}>Elegir foto<input className={styles.srOnly} type="file" aria-label="Elegir foto de perfil" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} /></label>}</div></section>
              {avatarFile && <><p>{avatarFile.name} · Todavía sin guardar</p><button type="button" className={styles.secondary} onClick={() => void uploadAvatar()}>Guardar foto</button><button type="button" className={styles.textButton} onClick={() => setAvatarFile(null)}>Quitar foto seleccionada</button></>}{groupError('avatarUrl')}
              <div className={styles.divider}><h2>Documentación privada</h2><p className={styles.hint}>Solo la usa Lysto para validar tu alta. Fotos JPG, PNG o WebP, hasta 10 MB.</p></div>
              {requiredDocuments.map((type) => {
                const document = latestRegistrationDocument(context, type)
                const status = registrationDocumentStatus(document)
                const label = { missing: 'Sin cargar', pending: 'Cargado · Pendiente de revisión', approved: 'Aprobado', rejected: 'Observado', expired: 'Vencido' }[status]
                return <section className={styles.document} key={type} data-status={status}>
                  <div className={styles.documentHeading}><FileText aria-hidden="true" /><div><h3>{documentLabels[type] ?? type}</h3><p>{label}</p></div>{document && <button className={styles.iconButton} type="button" aria-label={`Ver ${documentLabels[type] ?? type}`} onClick={() => void openDocument(document.id)}><ChevronRight aria-hidden="true" /></button>}</div>
                  {document?.reason && <p className={styles.fieldError}>{document.reason}</p>}{document?.expiresAt && <p className={styles.hint}>Vigencia: {document.expiresAt}</p>}
                  {expiryDocuments.includes(type) && <p className={styles.hint}>Lysto verificará la vigencia durante la revisión.</p>}
                  {documentUrl && document && documentUrl.id === document.id && <a className={styles.inlineButton} href={documentUrl.url} target="_blank" rel="noopener noreferrer">Abrir documento privado · 60 segundos</a>}
                  {editable && (document && !replacing.includes(type) ? <button type="button" className={styles.textButton} onClick={() => setReplacing([...replacing, type])}>Reemplazar {documentLabels[type] ?? type}</button> : <DocumentUpload key={`${type}-${document?.id ?? 'new'}`} professionalId={draft.professionalId} documentType={type} onPending={(pending) => setPendingDocuments(current => pending ? [...new Set([...current, type])] : current.filter(value => value !== type))} onBusy={(value) => documentBusy(type, value)} onSaved={() => {
                    documentBusy(`${type}-read`, true)
                    void readback(false).then(() => setReplacing((current) => current.filter((value) => value !== type))).catch(fail).finally(() => documentBusy(`${type}-read`, false))
                  }} />)}
                  {groupError(`documents.${type}`)}
                </section>
              })}
              {!context.requirements && <p className={styles.notice}>Los requisitos de tu especialidad no están disponibles. Podés guardar tu avance y volver a consultar.</p>}
              <div className={styles.notice}><Info aria-hidden="true" /><span>Vas a poder revisar todo antes de enviar.</span></div>
            </>}
            {step === 5 && <>
              <div className={styles.summary}>{summary.map((item, index) => <div className={styles.summaryRow} key={item.title}><item.icon aria-hidden="true" /><div><h2>{item.title}</h2><p>{item.value || 'Pendiente'}</p><small>{item.detail}</small></div><button type="button" className={styles.textButton} aria-label={`${editable ? 'Editar' : 'Ver'} ${item.title}`} onClick={() => { setReturnToReview(editable); navigate(index) }}>{editable ? 'Editar' : 'Ver'}<ChevronRight aria-hidden="true" /></button></div>)}</div>
              <p className={styles.hint}>El equipo de Lysto revisará la información enviada.</p>
              {editable && (context.legal ? <label className={styles.consent}><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Leí y acepto los <a href={context.legal.termsUrl} target="_blank" rel="noopener noreferrer">términos ({context.legal.termsVersion})</a> y la <a href={context.legal.privacyUrl} target="_blank" rel="noopener noreferrer">política de privacidad ({context.legal.privacyVersion})</a>.</span></label> : <p className={styles.notice}>Los documentos legales no están disponibles. Actualizá para volver a consultar.</p>)}
              {Object.keys(errors).length > 0 && <div className={styles.error} role="alert"><strong>Revisá lo siguiente antes de enviar:</strong><ul>{Object.entries(errors).map(([key, value]) => <li key={key}>{value}</li>)}</ul></div>}
              {dirty && <p className={styles.notice}>Guardá los cambios antes de enviar.</p>}
            </>}
          </fieldset>
        </form>
        {step === 6 && <RegistrationPayments state={account} />}
        <footer className={styles.footer}>
          {pendingAssets && <p className={styles.notice}>Guardá o quitá los archivos seleccionados antes de continuar o salir.</p>}
          {message && <p role="status" className={styles.saved}><CheckCircle2 aria-hidden="true" />{message}</p>}
          {editable && <button className={styles.primary} type="submit" form="registration-form" disabled={disabled || pendingAssets || step === 5 && (!accepted || dirty || !context.legal || !context.requirements)}>{busy ? 'Guardando…' : step === 5 ? 'Enviar postulación' : returnToReview ? 'Volver a revisión' : 'Guardar y continuar'}</button>}
          {!editable && viewApplication && <button type="button" className={styles.primary} disabled={disabled || pendingAssets} onClick={() => setViewApplication(false)}>Volver al estado de mi alta</button>}
          {step === 5 && <p className={styles.hint}>Tu información se enviará a revisión.</p>}
          {editable && <button type="button" className={styles.textButton} disabled={disabled || dirty || pendingAssets} onClick={() => void refresh()}>Actualizar información guardada</button>}
        </footer>
      </section>
    </>}
    {!isForm && <section className={styles.final}>
      <h1 ref={heading} tabIndex={-1}>{statusCopy[state as keyof typeof statusCopy]?.[0] ?? 'Continuá tu alta'}</h1><p className={styles.subtitle}>{statusCopy[state as keyof typeof statusCopy]?.[1] ?? 'Actualizá para consultar tu postulación.'}</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {state === 'ready' ? <div className={styles.notice} data-tone="success"><CheckCircle2 aria-hidden="true" />Podés recibir trabajos</div> : state === 'review' ? <div className={styles.notice}><Clock3 aria-hidden="true" />En revisión por el equipo de Lysto</div> : null}
      {!restricted && <div className={styles.summary}>
        <div className={styles.summaryRow}><FileText aria-hidden="true" /><div><h2>Datos recibidos</h2><p>{professionalStatusLabels[context.application.status]}</p></div><Check aria-hidden="true" /></div>
        <div className={styles.summaryRow}><ShieldCheck aria-hidden="true" /><div><h2>Documentación</h2><p>{state === 'ready' ? 'Vigente' : context.readinessReasons?.includes('documentos') ? 'Requiere revisión' : 'Consultá los documentos de tu postulación'}</p></div></div>
        <div className={styles.summaryRow}><Wrench aria-hidden="true" /><div><h2>Cuenta de cobro</h2><p>{account.loading ? 'Verificando conexión…' : account.error ? 'No pudimos verificarla' : account.account?.linked === true && account.account.configured ? 'Mercado Pago vinculado' : 'Pendiente de vinculación'}</p></div></div>
      </div>}
      {state === 'approved_pending' && <p className={styles.notice} data-tone="warning">Pendiente: {context.readinessReasons?.map((reason) => ({ documentos: 'documentación vigente', foto: 'foto de perfil', mercado_pago: 'conexión de cobros' })[reason]).join(', ') || 'verificar los requisitos de habilitación'}.</p>}
      {state === 'approved_pending' && context.readinessReasons?.includes('foto') && <button type="button" className={styles.secondary} onClick={() => { setViewApplication(true); navigate(4) }}>Completar foto de perfil</button>}
      {state === 'approved_pending' && context.readinessReasons?.includes('documentos') && <Link className={styles.secondary} href="/contacto">Consultar revisión de documentos</Link>}
      {(state === 'approved_pending' || state === 'unavailable') && !restricted && <RegistrationPayments state={account} />}
      {state === 'review' && <p className={styles.notice}><Info aria-hidden="true" />La configuración de cobros está completa. La revisión de Lysto sigue pendiente.</p>}
      <div className={styles.finalActions}>
        {state === 'ready' && <Link className={styles.primary} href="/pro/dashboard">Ir a mi panel</Link>}
        {!restricted && <button type="button" className={state === 'review' ? styles.primary : styles.secondary} disabled={disabled} onClick={() => { setViewApplication(true); navigate(5) }}>Ver mi postulación</button>}
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => void refresh()}>Actualizar estado</button>
        <Link className={styles.textButton} href="/contacto">Necesito ayuda</Link>
      </div>
      {'canChangePassword' in context && context.canChangePassword === true && <details className={styles.password}><summary>Actualizar contraseña</summary><p className={styles.hint}>Podés seguir usando tu contraseña provisoria o cambiarla ahora.</p><ProfessionalPasswordForm /></details>}
    </section>}
  </div>
}
