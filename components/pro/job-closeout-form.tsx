'use client'

import { ArrowLeft, ArrowRight, RotateCw } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { MediaUploader, type SavedPhoto } from '@/components/customer/media-uploader'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'
import styles from './job-closeout-form.module.css'

const resolutions = [
  ['resolved', 'Resuelto'], ['partially_resolved', 'Parcialmente resuelto'],
  ['pending_part', 'Pendiente de repuesto'], ['second_visit_required', 'Requiere segunda visita'],
  ['not_resolved', 'No resuelto']
] as const
const maintenanceOptions = [
  ['none', 'Sin seguimiento'], ['filters_30_days', 'Filtros en 30 días'],
  ['filters_60_days', 'Filtros en 60 días'], ['filters_90_days', 'Filtros en 90 días'],
  ['deep_cleaning_6_months', 'Limpieza en 6 meses'], ['deep_cleaning_annual', 'Limpieza anual'],
  ['gas_review_30_days', 'Revisión de gas en 30 días'], ['outdoor_unit_review', 'Revisión de unidad exterior'],
  ['electrical_review', 'Revisión eléctrica'], ['pending_part_replacement', 'Cambio de repuesto pendiente'],
  ['second_visit_recommended', 'Segunda visita']
] as const
const uuid = z.string().uuid()
const draftSchema = z.object({
  diagnosis: z.string().max(3000), work: z.string().max(3000), parts: z.string().max(9030),
  resolution: z.enum(['resolved', 'partially_resolved', 'pending_part', 'second_visit_required', 'not_resolved']),
  maintenance: z.enum(['none', 'filters_30_days', 'filters_60_days', 'filters_90_days', 'deep_cleaning_6_months', 'deep_cleaning_annual', 'gas_review_30_days', 'outdoor_unit_review', 'electrical_review', 'pending_part_replacement', 'second_visit_recommended']),
  notes: z.string().max(3000),
  evidenceIds: z.array(uuid).max(5).refine(ids => new Set(ids).size === ids.length)
}).strict()
const storedDraftSchema = z.object({
  version: z.literal(1), actorKey: z.string(), jobId: uuid, equipmentId: uuid, draft: draftSchema
}).strict()
const pendingSchema = z.object({ key: uuid, fingerprint: z.string().min(1), state: z.literal('pending') })
const reportSchema = z.object({ report: z.object({
  jobId: uuid, finalReportId: uuid, status: z.literal('completed_pending_customer_confirmation'),
  version: z.number().int().positive(), idempotent: z.boolean()
}) })
type Draft = z.infer<typeof draftSchema>
type Props = {
  jobId: string
  equipmentId: string
  initialDiagnosis?: string
  actorKey?: string
  onCompleted: () => void
  onBack?: () => void
  onRefresh?: () => void | Promise<void>
  onBusyChange?: (busy: boolean) => void
}
const emptyDraft = (diagnosis = ''): Draft => ({ diagnosis, work: '', parts: '', resolution: 'resolved', maintenance: 'none', notes: '', evidenceIds: [] })
function readStoredJson(value: string | null): unknown {
  try { return JSON.parse(value ?? 'null') } catch { return null }
}

// A blocked/full browser store must not break editing or change an in-flight command key.
function resilientSessionStorage() {
  const memory = new Map<string, string>()
  return {
    getItem(key: string) {
      if (memory.has(key)) return memory.get(key) ?? null
      try { return window.sessionStorage.getItem(key) } catch { return null }
    },
    setItem(key: string, value: string) {
      memory.set(key, value)
      try { window.sessionStorage.setItem(key, value) } catch { /* kept for this mounted form */ }
    },
    removeItem(key: string) {
      memory.delete(key)
      try { window.sessionStorage.removeItem(key) } catch { /* server success remains authoritative */ }
    }
  }
}

export function JobCloseoutForm(props: Props) {
  return <CloseoutFields key={`${props.actorKey ?? 'legacy'}:${props.jobId}:${props.equipmentId}`} {...props} />
}

function CloseoutFields({ jobId, equipmentId, actorKey = 'legacy', initialDiagnosis, onCompleted, onBack, onRefresh, onBusyChange }: Props) {
  const id = useId()
  const storage = useMemo(resilientSessionStorage, [])
  const storageKey = `lysto:closeout-draft:${actorKey}:${jobId}:${equipmentId}`
  const commandScope = `${actorKey}:${jobId}:${equipmentId}:closeout`
  const [draft, setDraft] = useState(() => emptyDraft(initialDiagnosis))
  const [ready, setReady] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [saved, setSaved] = useState<SavedPhoto[]>([])
  const [busy, setBusy] = useState({ upload: false, submit: false })
  const [message, setMessage] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [consulted, setConsulted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const operations = useRef({ upload: false, submit: false })
  const alive = useRef(true)
  const requestController = useRef<AbortController | null>(null)
  const callbacks = useRef({ onCompleted, onRefresh, onBusyChange })
  callbacks.current = { onCompleted, onRefresh, onBusyChange }
  const active = busy.upload || busy.submit

  useEffect(() => {
    alive.current = true
    const stored = storedDraftSchema.safeParse(readStoredJson(storage.getItem(storageKey)))
    if (stored.success && stored.data.actorKey === actorKey && stored.data.jobId === jobId && stored.data.equipmentId === equipmentId) setDraft(stored.data.draft)
    const pending = pendingSchema.safeParse(readStoredJson(storage.getItem(`lysto:command:${commandScope}`)))
    if (pending.success) {
      setUncertain(true)
      setMessage('Hay un envío sin confirmar. Consultá el estado antes de volver a enviarlo.')
    }
    setReady(true)
    return () => {
      alive.current = false
      requestController.current?.abort()
      callbacks.current.onBusyChange?.(false)
    }
  }, [actorKey, commandScope, equipmentId, jobId, storage, storageKey])

  useEffect(() => {
    if (ready) storage.setItem(storageKey, JSON.stringify({ version: 1, actorKey, jobId, equipmentId, draft }))
  }, [actorKey, draft, equipmentId, jobId, ready, storage, storageKey])

  function operation(kind: 'upload' | 'submit', value: boolean) {
    if (!alive.current) return
    operations.current = { ...operations.current, [kind]: value }
    setBusy(operations.current)
    callbacks.current.onBusyChange?.(operations.current.upload || operations.current.submit)
  }
  function update(values: Partial<Draft>) { setDraft(current => ({ ...current, ...values })) }

  const evidenceIds = [...new Set([...draft.evidenceIds, ...saved.map(photo => photo.upload.attachmentId)])]
  const partsUsed = draft.parts.split('\n').map(value => value.trim()).filter(Boolean)
  const followup = ['pending_part', 'second_visit_required', 'not_resolved'].includes(draft.resolution)
  const pendingPhotos = files.some(file => !saved.some(photo => photo.file === file))
  const valid = draftSchema.safeParse(draft).success && uuid.safeParse(jobId).success && uuid.safeParse(equipmentId).success &&
    draft.diagnosis.trim().length >= 8 && draft.work.trim().length >= 8 &&
    evidenceIds.length >= 1 && evidenceIds.length <= 5 && partsUsed.length <= 30 &&
    partsUsed.every(part => part.length >= 2 && part.length <= 300) && (!followup || draft.parts.trim().length >= 8)
  const restoredEvidenceCount = draft.evidenceIds.filter(value => !saved.some(photo => photo.upload.attachmentId === value)).length

  async function consultServer() {
    const refresh = callbacks.current.onRefresh
    if (!refresh) {
      if (alive.current) setMessage('El envío quedó sin confirmar. Volvé al trabajo y consultá su estado antes de reintentar.')
      return
    }
    try {
      await refresh()
      if (alive.current) { setConsulted(true); setMessage('Estado consultado. Si el informe todavía no aparece, podés reenviar este mismo intento sin duplicarlo.') }
    } catch {
      if (alive.current) { setConsulted(false); setMessage('No pudimos consultar el estado. Conservamos el intento; consultá nuevamente antes de reenviarlo.') }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || submitted || operations.current.upload || operations.current.submit || !valid || pendingPhotos || (uncertain && !consulted)) return
    operation('submit', true)
    const payload = { jobId, equipmentId, realDiagnosis: draft.diagnosis, workDone: draft.work, partsUsed,
      resolutionStatus: draft.resolution, maintenanceOption: draft.maintenance,
      internalNotes: draft.notes || undefined, afterPhotoIds: evidenceIds }
    const pending = recoverCommand(storage, commandScope, JSON.stringify(payload))
    const controller = new AbortController()
    requestController.current = controller
    const timeout = setTimeout(() => controller.abort(), 30_000)
    setMessage('Enviando el informe…')
    try {
      const response = await fetch('/api/jobs/final-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idempotencyKey: pending.key }),
        signal: controller.signal
      })
      const body: unknown = await response.json()
      if (!alive.current) return
      if (!response.ok) {
        if (response.status >= 500 || response.status === 409) throw new Error('uncertain')
        const error = z.object({ error: z.string().max(1000) }).safeParse(body)
        setMessage(error.success ? error.data.error : 'No pudimos enviar el informe. Revisá los datos e intentá nuevamente.')
        return
      }
      const result = reportSchema.safeParse(body)
      if (!result.success || result.data.report.jobId !== jobId) throw new Error('uncertain')
      acknowledgeCommand(storage, commandScope, pending.key)
      storage.removeItem(storageKey)
      setSubmitted(true)
      setUncertain(false)
      setMessage('Informe enviado. Falta la confirmación del cliente.')
      try { callbacks.current.onCompleted() } catch { setMessage('Informe enviado. Volvé al trabajo para consultar el resultado.') }
    } catch {
      if (!alive.current) return
      setUncertain(true)
      setConsulted(false)
      setMessage('No pudimos confirmar el envío. Conservamos el intento y consultamos el estado antes de repetirlo.')
      await consultServer()
    } finally { clearTimeout(timeout); operation('submit', false) }
  }

  return (
    <form className={styles.form} onSubmit={event => void submit(event)} aria-labelledby={`${id}-title`} aria-busy={active}>
      <header className={styles.header}>
        <h2 id={`${id}-title`}>Completá el informe</h2>
        <p>El cliente confirmará el resultado después de recibirlo.</p>
      </header>
      <fieldset className={styles.fields} disabled={!ready || active || uncertain || submitted}>
        <label className={styles.field}>
          <span>Resultado</span>
          <select value={draft.resolution} onChange={event => update({ resolution: event.target.value as Draft['resolution'] })}>
            {resolutions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Diagnóstico final</span>
          <textarea rows={2} maxLength={3000} value={draft.diagnosis} onChange={event => update({ diagnosis: event.target.value })} placeholder="Qué falla encontraste en el equipo" />
        </label>
        <label className={styles.field}>
          <span>Trabajo realizado</span>
          <textarea rows={2} maxLength={3000} value={draft.work} onChange={event => update({ work: event.target.value })} placeholder="Qué hiciste y cómo verificaste el resultado" />
        </label>
        <label className={styles.field}>
          <span id={`${id}-parts-label`}>{followup ? 'Repuesto o seguimiento pendiente' : 'Repuestos utilizados, uno por línea'}</span>
          <textarea aria-labelledby={`${id}-parts-label`} aria-describedby={followup ? `${id}-parts-hint` : undefined} rows={2} maxLength={9030} value={draft.parts} onChange={event => update({ parts: event.target.value })} placeholder={followup ? 'Detallá qué falta y el próximo paso' : 'Si no utilizaste repuestos, dejalo vacío'} />
          {followup ? <small id={`${id}-parts-hint`}>Explicá lo pendiente con al menos 8 caracteres.</small> : null}
        </label>
        <section className={styles.photos} aria-labelledby={`${id}-photos`}>
          <h3 id={`${id}-photos`}>Fotos finales</h3>
          <MediaUploader files={files} onFilesChange={setFiles} maxFiles={5 - restoredEvidenceCount} savedPhotos={saved}
            onSavedPhotosChange={photos => {
              const verified = photos.filter(photo => uuid.safeParse(photo.upload.attachmentId).success && photo.upload.entityId === jobId)
              setSaved(verified)
              update({ evidenceIds: [...new Set([...draft.evidenceIds, ...verified.map(photo => photo.upload.attachmentId)])] })
            }}
            onBusyChange={value => operation('upload', value)} target={{ kind: 'job-photo', entityId: jobId, phase: 'after' }} />
          <p className={styles.hint}>Fotos finales verificadas: {evidenceIds.length} de 5. Se exige al menos una.</p>
          {restoredEvidenceCount ? <p className={styles.hint}>Recuperamos {restoredEvidenceCount} foto(s) guardada(s) para este informe. El servidor verificará que correspondan al trabajo.</p> : null}
          {pendingPhotos ? <p className={styles.hint}>Guardá todas las fotos seleccionadas antes de enviar el informe.</p> : null}
        </section>
        <details className={styles.details}>
          <summary>Mantenimiento recomendado</summary>
          <label className={styles.field}>
            <span>Seguimiento recomendado</span>
            <select value={draft.maintenance} onChange={event => update({ maintenance: event.target.value as Draft['maintenance'] })}>
              {maintenanceOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </details>
        <details className={styles.details}>
          <summary>Notas internas <span>Opcional</span></summary>
          <label className={styles.field}>
            <span id={`${id}-notes-label`}>Notas internas</span>
            <textarea aria-labelledby={`${id}-notes-label`} aria-describedby={`${id}-notes-hint`} rows={2} maxLength={3000} value={draft.notes} onChange={event => update({ notes: event.target.value })} />
            <small id={`${id}-notes-hint`}>Estas notas no se comparten con el cliente.</small>
          </label>
        </details>
      </fieldset>
      {message ? <p className={styles.message} role="status">{message}</p> : null}
      {uncertain && onRefresh ? <button type="button" className={styles.secondary} disabled={active} onClick={() => {
        if (operations.current.submit || operations.current.upload) return
        operation('submit', true)
        void consultServer().finally(() => operation('submit', false))
      }}><RotateCw size={17} aria-hidden="true" />Consultar estado</button> : null}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={!ready || active || submitted || !valid || pendingPhotos || (uncertain && !consulted)}>
          <span>{busy.submit ? 'Enviando el informe…' : 'Enviar informe al cliente'}</span><ArrowRight size={18} aria-hidden="true" />
        </button>
        {onBack ? <button type="button" className={styles.back} disabled={active} onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />Volver al trabajo</button> : null}
      </div>
    </form>
  )
}
