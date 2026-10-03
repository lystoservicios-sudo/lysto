'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { OnboardingContext } from '@/lib/professional/onboarding-context'
import {
  onboardingFields,
  type ProfessionalApplication
} from '@/lib/professional/onboarding-contracts'
import { requiredAirConditioningTools } from '@/lib/professional/tool-checklist'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { MediaUploader } from '@/components/customer/media-uploader'
import { MarketplaceAccount } from '@/components/payments/marketplace-account'

export const professionalStatusLabels: Record<string, string> = {
  invited: 'Invitado',
  form_started: 'Borrador',
  form_submitted: 'Enviado a revisión',
  under_review: 'En revisión',
  rejected: 'Requiere correcciones',
  approved: 'Aprobado',
  suspended: 'Suspendido',
  inactive: 'Inactivo'
}
export const documentLabels: Record<string, string> = {
  identity: 'Documento de identidad',
  identity_front: 'DNI frente',
  identity_back: 'DNI dorso',
  license: 'Matrícula',
  insurance: 'Seguro',
  tax: 'Constancia fiscal',
  profile: 'Foto de perfil (documento privado anterior)'
}
const toolLabels: Record<string, string> = {
  vacuum_pump: 'Bomba de vacío',
  manifold_r410a_r32: 'Manifold R410A / R32',
  digital_scale: 'Balanza digital',
  multimeter: 'Multímetro',
  clamp_meter: 'Pinza amperométrica',
  leak_detector: 'Detector de fugas',
  thermometer: 'Termómetro',
  ladder: 'Escalera',
  safety_equipment: 'Elementos de seguridad'
}
const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const inputClass = 'mt-2 block min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100'
const buttonClass = 'inline-flex min-h-12 items-center justify-center rounded-2xl bg-lysto-blueDark px-5 font-semibold text-white shadow-soft transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50'

function DocumentUpload({
  professionalId,
  documentType,
  onSaved,
  onBusy
}: {
  professionalId: string
  documentType: string
  onSaved: () => void
  onBusy: (busy: boolean) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <h3 className="font-semibold text-slate-900">{documentLabels[documentType] ?? documentType}</h3>
      <MediaUploader
        files={files}
        onFilesChange={setFiles}
        maxFiles={1}
        target={{
          kind: 'professional-document',
          entityId: professionalId,
          documentType,
          scope: 'professional-onboarding'
        }}
        onBusyChange={onBusy}
        onSavedPhotosChange={onSaved}
      />
    </section>
  )
}

export function ConnectedProfessionalOnboarding({ initial }: { initial: OnboardingContext }) {
  const [context, setContext] = useState(initial)
  const [draft, setDraft] = useState(initial.application)
  const [step, setStep] = useState(() => {
    const app = initial.application
    if (!['form_started', 'rejected'].includes(app.status)) return 4
    if (!app.phone || !app.dni || !app.address) return 0
    if (!app.zoneIds.length || !app.availability.length) return 1
    if (!initial.avatarUrl || !initial.documents.length) return 2
    return ['form_started', 'rejected'].includes(app.status) ? 3 : 4
  })
  const [busy, setBusy] = useState(true)
  // Do not accept edits before hydration installs the change handlers.
  useEffect(() => {
    setBusy(false)
  }, [])
  const [uploading, setUploading] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [documentUrl, setDocumentUrl] = useState<{ id: string; url: string } | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(null); return }
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])
  const editable = ['form_started', 'rejected'].includes(context.application.status)
  const dirty = JSON.stringify(draft) !== JSON.stringify(context.application)
  const disabled = busy || uploading
  const requiredDocuments = [
    ...new Set(['identity_front', 'identity_back', 'license',
      ...(context.requirements?.policies.flatMap((policy) => policy.requiredDocuments) ?? [])])
  ]
  const documentsReady = Boolean(context.avatarUrl && context.requirements && requiredDocuments.length &&
    requiredDocuments.every((type) => context.documents.some((document) =>
      document.documentType === type && document.status !== 'rejected')))
  function update<K extends keyof ProfessionalApplication>(
    key: K,
    value: ProfessionalApplication[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
    setMessage('')
  }
  async function reload(replaceDraft = true) {
    setBusy(true)
    setError('')
    try {
      const next = await privateRequest<OnboardingContext>('/api/professional/onboarding/context')
      setContext(next)
      setAccepted(false)
      if (replaceDraft) setDraft(next.application)
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (disabled) return
    if (step === 0 && (draft.address ?? '').trim().length < 5) {
      setError('Completá tu dirección antes de continuar.')
      return
    }
    if (step === 1 && draft.availability.length === 0) {
      setError('Agregá al menos un horario semanal antes de continuar.')
      return
    }
    if (!dirty) { setStep((current) => Math.min(current + 1, 4)); return }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const valid = onboardingFields.strip().safeParse(draft)
      if (!valid.success)
        throw new Error('Revisá los datos y los horarios ingresados antes de guardar.')
      let saved = await privateRequest<ProfessionalApplication>(
        '/api/professional/onboarding',
        'POST',
        { ...valid.data, expectedVersion: draft.version }
      )
      if (step === 0 && (draft.address ?? '') !== (context.application.address ?? ''))
        saved = await privateRequest<ProfessionalApplication>('/api/professional/onboarding/address',
          'POST', { address: draft.address, expectedVersion: saved.version })
      const reconciled = { ...saved, address: saved.address ?? draft.address ?? '' }
      setDraft(reconciled)
      setContext((current) => ({ ...current, application: reconciled }))
      setMessage('Borrador guardado.')
      await reload()
      setStep((current) => Math.min(current + 1, 4))
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function submit() {
    if (disabled || dirty || !context.legal || !accepted) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await privateRequest('/api/professional/onboarding/submit', 'POST', {
        expectedVersion: draft.version,
        accepted,
        termsVersion: context.legal.termsVersion,
        privacyVersion: context.legal.privacyVersion
      })
      await reload()
      setMessage('Postulación enviada. Podés consultar acá el resultado de la revisión.')
      setStep(4)
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function openDocument(id: string) {
    setBusy(true)
    setError('')
    setDocumentUrl(null)
    try {
      const result = await privateRequest<{ url: string }>(
        '/api/professional/onboarding/documents/read',
        'POST',
        { intentId: id }
      )
      setDocumentUrl({ id, url: result.url })
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function uploadAvatar() {
    if (!avatarFile || disabled) return
    setUploading(true)
    setError('')
    try {
      const response = await fetch('/api/professional/onboarding/avatar', {
        method: 'POST', headers: { 'Content-Type': avatarFile.type }, body: avatarFile
      })
      if (!response.ok) throw new Error('No pudimos guardar la foto. Usá JPG, PNG o WebP de hasta 2 MB.')
      setAvatarFile(null)
      await reload(false)
      setMessage('Foto de perfil guardada.')
    } catch (failure) { setError(requestError(failure)) }
    finally { setUploading(false) }
  }
  const personalFields = [
    ['firstName', 'Nombre'],
    ['lastName', 'Apellido'],
    ['phone', 'Teléfono'],
    ['dni', 'DNI'],
    ['cuil', 'CUIL']
  ] as const
  const activityFields = [
    ['licenseNumber', 'Número de matrícula'],
    ['licenseEntity', 'Entidad que emite la matrícula'],
    ['mobilityType', 'Tipo de movilidad']
  ] as const
  const steps = ['Datos personales y domicilio', 'Actividad y disponibilidad', 'Foto y documentos', 'Enviar a revisión', 'Mercado Pago']
  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-700">Tu perfil profesional</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Mi postulación</h1>
              <p className="mt-2 text-sm text-slate-600">{draft.email}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${context.application.status === 'approved' ? 'bg-emerald-500' : context.application.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'}`} />
              {professionalStatusLabels[context.application.status]}
            </span>
          </div>
          {step !== 4 && <p className="mt-5 max-w-3xl leading-7 text-slate-600">
            Completá tus datos, documentación, foto y cuenta de cobro. Operaciones revisará el expediente antes de habilitar trabajos nuevos.
          </p>}
        </div>
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-8">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-800">Etapa actual</span>
            <span className="text-slate-500">Paso {step + 1} de {steps.length}</span>
          </div>
          <div role="progressbar" aria-label="Paso actual de la postulación" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-lysto-blue transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <nav aria-label="Pasos de la postulación" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {steps.map((label, index) => <button key={label} type="button"
              aria-current={step === index ? 'step' : undefined}
              className={`flex min-h-12 items-center gap-2 rounded-xl px-2 py-2 text-left text-xs leading-4 transition sm:px-3 ${step === index ? 'bg-white font-bold text-blue-800 shadow-sm ring-1 ring-blue-100' : index < step ? 'text-slate-700 hover:bg-white' : 'text-slate-400'}`}
              disabled={disabled || index > step || (dirty && index !== step)}
              onClick={() => setStep(index)}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === index ? 'bg-lysto-blueDark text-white' : index < step ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>{index < step ? '✓' : index + 1}</span>
              <span>{label}</span>
            </button>)}
          </nav>
          {step !== 4 && <button
            className="mt-4 text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-blue-700"
            disabled={disabled}
            onClick={() => void reload()}
          >
            Recargar datos guardados{dirty ? ' (descartar cambios locales)' : ''}
          </button>}
        </div>
      </header>
      {message && step !== 4 && (
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </p>
      )}
      {context.application.status === 'approved' && (
        <p>
          {(context.readyForNewWork ?? context.eligible)
            ? 'Tu revisión fue aprobada y ya podés recibir trabajos nuevos.'
            : 'Tu revisión fue aprobada, pero todavía no podés recibir trabajos nuevos.'}{' '}
          {context.eligible && (
            <Link className="underline" href="/pro/dashboard">
              Ir al panel profesional
            </Link>
          )}
        </p>
      )}
      {context.decisionReason && <p>Última resolución: {context.decisionReason}</p>}
      {context.application.status === 'rejected' && (
        <p>
          Revisá las observaciones de tus documentos, corregí la información y volvé a enviar la
          postulación.
        </p>
      )}
      {step <= 1 && <form id="datos-profesionales" onSubmit={save} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <fieldset disabled={!editable || disabled} className="space-y-5">
          <legend className="text-xl font-bold tracking-tight text-slate-950">{steps[step]}</legend>
          <p className="-mt-3 border-b border-slate-100 pb-4 text-sm leading-6 text-slate-600">{step === 0 ? 'Contanos quién sos y dónde podemos ubicarte.' : 'Definí qué trabajos realizás, dónde y en qué horarios.'}</p>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {(step === 0 ? personalFields : activityFields).map(([key, label]) => (
              <label key={key} className="block text-sm font-medium text-slate-700">
                {label}
                <input
                  className={inputClass}
                  value={draft[key]}
                  maxLength={100}
                  onChange={(event) => update(key, event.target.value)}
                />
              </label>
            ))}
            {step === 0 && <label className="block text-sm font-medium text-slate-700">
              Fecha de nacimiento
              <input
                type="date"
                className={inputClass}
                value={draft.birthdate}
                onChange={(event) => update('birthdate', event.target.value)}
              />
            </label>}
            {step === 0 && <label className="block text-sm font-medium text-slate-700">Dirección
              <input className={inputClass} value={draft.address ?? ''} minLength={5} maxLength={200}
                required onChange={(event) => update('address', event.target.value)} />
            </label>}
            {step === 1 && <label>
              Años de experiencia
              <input
                type="number"
                min={0}
                max={80}
                className={inputClass}
                value={draft.yearsExperience}
                onChange={(event) => update('yearsExperience', Number(event.target.value))}
              />
            </label>}
          </div>
          {step === 1 && <>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={draft.hasMobility}
              onChange={(event) => update('hasMobility', event.target.checked)}
            />{' '}
            Tengo movilidad propia
          </label>
          <label className="block">
            Experiencia y presentación
            <textarea
              className={inputClass}
              rows={4}
              maxLength={2000}
              value={draft.bio}
              onChange={(event) => update('bio', event.target.value)}
            />
          </label>
          {(['categories', 'zones'] as const).map((resource) => {
            const key = resource === 'categories' ? 'categoryIds' : 'zoneIds'
            return (
              <fieldset key={resource} className="space-y-2 rounded-2xl border border-slate-200 p-4 sm:p-5">
                <legend className="px-1 font-semibold text-slate-900">
                  {resource === 'categories' ? 'Especialidades' : 'Zonas de trabajo'}
                </legend>
                {context.catalog[resource].map((item) => (
                  <label className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50" key={item.id}>
                    <input className="h-4 w-4 accent-blue-700"
                      type="checkbox"
                      checked={draft[key].includes(item.id)}
                      onChange={(event) =>
                        update(
                          key,
                          event.target.checked
                            ? [...draft[key], item.id]
                            : draft[key].filter((id) => id !== item.id)
                        )
                      }
                    />{' '}
                    {item.name}
                  </label>
                ))}
              </fieldset>
            )
          })}
          <fieldset className="space-y-2 rounded-2xl border border-slate-200 p-4 sm:p-5">
            <legend className="px-1 font-semibold text-slate-900">Herramientas disponibles</legend>
            {requiredAirConditioningTools.map((tool) => (
              <label key={tool} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                <input className="h-4 w-4 accent-blue-700"
                  type="checkbox"
                  checked={draft.tools.includes(tool)}
                  onChange={(event) =>
                    update(
                      'tools',
                      event.target.checked
                        ? [...draft.tools, tool]
                        : draft.tools.filter((item) => item !== tool)
                    )
                  }
                />{' '}
                {toolLabels[tool]}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4 sm:p-5">
            <legend className="px-1 font-semibold text-slate-900">Disponibilidad semanal</legend>
            {draft.availability.map((slot, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
                <label className="text-sm font-medium text-slate-700">
                  Día {index + 1}
                  <select
                    className={inputClass}
                    value={slot.weekday}
                    onChange={(event) =>
                      update(
                        'availability',
                        draft.availability.map((value, i) =>
                          i === index ? { ...value, weekday: Number(event.target.value) } : value
                        )
                      )
                    }
                  >
                    {weekdays.map((day, i) => (
                      <option key={day} value={i}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                {(['startTime', 'endTime'] as const).map((key) => (
                <label key={key} className="text-sm font-medium text-slate-700">
                    {key === 'startTime' ? 'Desde' : 'Hasta'} {index + 1}
                    <input
                      className={inputClass}
                      type="time"
                      value={slot[key]}
                      onChange={(event) =>
                        update(
                          'availability',
                          draft.availability.map((value, i) =>
                            i === index ? { ...value, [key]: event.target.value } : value
                          )
                        )
                      }
                    />
                  </label>
                ))}
                <button
                  type="button"
                  className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-500 underline underline-offset-4 hover:text-red-700"
                  onClick={() =>
                    update(
                      'availability',
                      draft.availability.filter((_, i) => i !== index)
                    )
                  }
                >
                  Quitar horario {index + 1}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-blue-700 underline underline-offset-4 hover:text-blue-900"
              disabled={draft.availability.length >= 50}
              onClick={() =>
                update('availability', [
                  ...draft.availability,
                  { weekday: 1, startTime: '09:00', endTime: '17:00' }
                ])
              }
            >
              Agregar horario
            </button>
          </fieldset>
          </>}
          {editable && (
            <button type="submit" className={buttonClass}>
              Guardar y continuar
            </button>
          )}
        </fieldset>
      </form>}
      {step === 2 && <><section id="foto-profesional" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Tu identidad en Lysto</p><h2 className="mt-1 text-xl font-bold tracking-tight">Foto de perfil</h2></div>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">Esta foto será pública para que los clientes puedan reconocerte. No subas una foto de tu DNI o de tu matrícula aquí.</p>
        {(avatarPreview || context.avatarUrl) && <Image unoptimized src={avatarPreview || context.avatarUrl || ''} alt="Foto de perfil del profesional" width={128} height={128} className="h-32 w-32 rounded-full object-cover" />}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
        <button type="button" className={buttonClass} disabled={!avatarFile || disabled} onClick={() => void uploadAvatar()}>Guardar foto</button>
      </section>
      <section id="documentos-profesionales" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Credenciales del oficio</p><h2 className="mt-1 text-xl font-bold tracking-tight">Documentación y revisión</h2></div>
        {!context.requirements && (
          <p>
            Los requisitos de las especialidades elegidas todavía no están habilitados. Podés
            guardar el borrador; el envío se habilitará cuando estén definidos.
          </p>
        )}
        {context.requirements?.policies.map((policy) => (
          <p key={policy.categoryId}>
            {context.catalog.categories.find((item) => item.id === policy.categoryId)?.name}:
            experiencia mínima {policy.minExperience} años
            {policy.requiresLicense ? ', matrícula obligatoria' : ''}.{' '}
            {policy.requiredTools.length > 0 &&
              'Herramientas requeridas: ' +
                policy.requiredTools.map((tool) => toolLabels[tool] ?? tool).join(', ')}
            .
          </p>
        ))}
        {context.documents.length === 0 && <p>Todavía no hay documentos guardados.</p>}
        <ul className="space-y-3">
          {context.documents.map((document) => (
            <li key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <strong>{documentLabels[document.documentType] ?? document.documentType}</strong> ·{' '}
              {
                { pending: 'Pendiente de revisión', approved: 'Aprobado', rejected: 'Observado' }[
                  document.status
                ]
              }
              {document.expiresAt && <span> · Vigencia: {document.expiresAt}</span>}
              {document.reason && <p>{document.reason}</p>}
              <button
                type="button"
                className="underline"
                disabled={disabled}
                onClick={() => void openDocument(document.id)}
              >
                Preparar vista privada
              </button>
              {documentUrl?.id === document.id && (
                <p>
                  <a
                    className="underline"
                    href={documentUrl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir documento (enlace válido por 60 segundos)
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <fieldset disabled={disabled} className="space-y-3">
            <legend>Adjuntar documentos solicitados</legend>
            {requiredDocuments.map((type) => (
              <DocumentUpload
                key={type}
                documentType={type}
                professionalId={draft.professionalId}
                onBusy={setUploading}
                onSaved={() => void reload(false)}
              />
            ))}
          </fieldset>
        )}
      </section>
      {!documentsReady && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Para continuar, cargá tu foto de perfil y todos los documentos solicitados.</p>}
      <button type="button" className={buttonClass} disabled={disabled || !documentsReady} onClick={() => setStep(3)}>Continuar a revisión</button>
      </>}
      {step === 3 && editable && (
        <section id="enviar-postulacion" className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Última revisión</p><h2 className="mt-1 text-xl font-bold tracking-tight">Enviar a revisión</h2><p className="mt-1 text-sm leading-6 text-slate-600">Confirmá tus datos y la documentación para que Operaciones pueda revisar tu perfil.</p></div>
          {context.legal ? (
            <label className="block">
              <input className="mt-1 h-4 w-4 accent-blue-700"
                type="checkbox"
                checked={accepted}
                disabled={disabled}
                onChange={(event) => setAccepted(event.target.checked)}
              />{' '}
              Leí y acepto los{' '}
              <a
                className="underline"
                href={context.legal.termsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                términos ({context.legal.termsVersion})
              </a>{' '}
              y la{' '}
              <a
                className="underline"
                href={context.legal.privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                política de privacidad ({context.legal.privacyVersion})
              </a>
              .
            </label>
          ) : (
            <p>El envío está pendiente de la habilitación de los documentos legales.</p>
          )}
          {dirty && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Guardá los cambios antes de enviar.</p>}
          <button
            type="button"
            className={buttonClass}
            disabled={disabled || dirty || !accepted || !context.legal || !context.requirements}
            onClick={submit}
          >
            Enviar postulación
          </button>
        </section>
      )}
      {step !== 4 && context.readinessReasons && context.readinessReasons.length > 0 &&
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Para recibir trabajos nuevos falta: {context.readinessReasons.map((reason) => ({ documentos: 'documentación vigente', foto: 'foto de perfil', mercado_pago: 'cuenta de Mercado Pago' })[reason]).join(', ')}.</p>}
      {step === 4 && <section id="cobros-profesionales" aria-label="Vinculación de cobros" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <MarketplaceAccount onboarding />
      </section>}
    </div>
  )
}
