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
const inputClass = 'block w-full rounded border border-slate-300 bg-white p-3 disabled:bg-slate-100'
const buttonClass = 'rounded bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50'

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
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">{documentLabels[documentType] ?? documentType}</h3>
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
    ...new Set(context.requirements?.policies.flatMap((policy) => policy.requiredDocuments) ?? [])
  ]
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
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const valid = onboardingFields.strip().safeParse(draft)
      if (!valid.success)
        throw new Error('Revisá los datos y los horarios ingresados antes de guardar.')
      const saved = await privateRequest<ProfessionalApplication>(
        '/api/professional/onboarding',
        'POST',
        { ...valid.data, expectedVersion: draft.version }
      )
      setDraft(saved)
      setContext((current) => ({ ...current, application: saved }))
      setMessage('Borrador guardado.')
      await reload()
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
  const textFields = [
    ['firstName', 'Nombre'],
    ['lastName', 'Apellido'],
    ['phone', 'Teléfono'],
    ['dni', 'DNI'],
    ['cuil', 'CUIL'],
    ['licenseNumber', 'Número de matrícula'],
    ['licenseEntity', 'Entidad que emite la matrícula'],
    ['mobilityType', 'Tipo de movilidad']
  ] as const
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Mi postulación</h1>
        <p>
          {draft.email} · <strong>{professionalStatusLabels[context.application.status]}</strong>
        </p>
        <p>
          Completá tus datos, documentación, foto y cuenta de cobro. Operaciones revisará el expediente
          antes de habilitar trabajos nuevos.
        </p>
        <nav aria-label="Pasos de la postulación" className="flex flex-wrap gap-3 text-sm">
          <a className="underline" href="#datos-profesionales">1. Datos y horarios</a>
          <a className="underline" href="#foto-profesional">2. Foto</a>
          <a className="underline" href="#documentos-profesionales">3. Documentos</a>
          <a className="underline" href="#enviar-postulacion">4. Enviar a revisión</a>
          <a className="underline" href="#cobros-profesionales">5. Mercado Pago</a>
        </nav>
        <button
          className="underline disabled:opacity-50"
          disabled={disabled}
          onClick={() => void reload()}
        >
          Recargar datos guardados{dirty ? ' (descartar cambios locales)' : ''}
        </button>
      </header>
      {message && (
        <p role="status" className="rounded bg-green-50 p-3">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-900">
          {error}
        </p>
      )}
      {context.application.status === 'approved' && (
        <p>
          {context.readyForNewWork
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
      <form id="datos-profesionales" onSubmit={save} className="space-y-5 rounded-2xl border bg-white p-5">
        <fieldset disabled={!editable || disabled} className="space-y-5">
          <legend className="text-xl font-bold">Información profesional</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {textFields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  className={inputClass}
                  value={draft[key]}
                  maxLength={100}
                  onChange={(event) => update(key, event.target.value)}
                />
              </label>
            ))}
            <label>
              Fecha de nacimiento
              <input
                type="date"
                className={inputClass}
                value={draft.birthdate}
                onChange={(event) => update('birthdate', event.target.value)}
              />
            </label>
            <label>
              Años de experiencia
              <input
                type="number"
                min={0}
                max={80}
                className={inputClass}
                value={draft.yearsExperience}
                onChange={(event) => update('yearsExperience', Number(event.target.value))}
              />
            </label>
          </div>
          <label className="block">
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
              <fieldset key={resource} className="space-y-2">
                <legend className="font-semibold">
                  {resource === 'categories' ? 'Especialidades' : 'Zonas de trabajo'}
                </legend>
                {context.catalog[resource].map((item) => (
                  <label className="block" key={item.id}>
                    <input
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
          <fieldset className="space-y-2">
            <legend className="font-semibold">Herramientas disponibles</legend>
            {requiredAirConditioningTools.map((tool) => (
              <label key={tool} className="block">
                <input
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
          <fieldset className="space-y-3">
            <legend className="font-semibold">Disponibilidad semanal</legend>
            {draft.availability.map((slot, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3">
                <label>
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
                  <label key={key}>
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
                  className="p-3 underline"
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
              className="underline"
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
          {editable && (
            <button type="submit" className={buttonClass} disabled={!dirty}>
              Guardar borrador
            </button>
          )}
        </fieldset>
      </form>
      <section id="foto-profesional" className="space-y-3 rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-bold">Foto de perfil</h2>
        <p>Esta foto será pública. No subas una foto de tu DNI o de tu matrícula aquí.</p>
        {(avatarPreview || context.avatarUrl) && <Image unoptimized src={avatarPreview || context.avatarUrl || ''} alt="Foto de perfil del profesional" width={128} height={128} className="h-32 w-32 rounded-full object-cover" />}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
        <button type="button" className={buttonClass} disabled={!avatarFile || disabled} onClick={() => void uploadAvatar()}>Guardar foto</button>
      </section>
      <section id="documentos-profesionales" className="space-y-4 rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-bold">Documentación y revisión</h2>
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
            <li key={document.id} className="rounded border p-3">
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
      {editable && (
        <section id="enviar-postulacion" className="space-y-4 rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-bold">Enviar a revisión</h2>
          {context.legal ? (
            <label className="block">
              <input
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
          {dirty && <p>Guardá los cambios antes de enviar.</p>}
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
      {context.readinessReasons && context.readinessReasons.length > 0 &&
        <p>Para recibir trabajos nuevos falta: {context.readinessReasons.map((reason) => ({ documentos: 'documentación vigente', foto: 'foto de perfil', mercado_pago: 'cuenta de Mercado Pago' })[reason]).join(', ')}.</p>}
      <section id="cobros-profesionales" aria-label="Vinculación de cobros" className="rounded-2xl border bg-white p-5">
        <MarketplaceAccount onboarding />
      </section>
    </div>
  )
}
