'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'
import { MediaUploader, type SavedPhoto } from '@/components/customer/media-uploader'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'

type Draft = {
  diagnosis: string
  work: string
  parts: string
  resolution: string
  maintenance: string
  notes: string
  evidenceIds: string[]
}
const initial: Draft = {
  diagnosis: '',
  work: '',
  parts: '',
  resolution: 'resolved',
  maintenance: 'none',
  notes: '',
  evidenceIds: []
}
export function JobCloseoutForm({
  jobId,
  equipmentId,
  initialDiagnosis,
  onCompleted
}: {
  jobId: string
  equipmentId: string
  initialDiagnosis?: string
  onCompleted: () => void
}) {
  const [draft, setDraft] = useState<Draft>({ ...initial, diagnosis: initialDiagnosis ?? '' }),
    [files, setFiles] = useState<File[]>([]),
    [saved, setSaved] = useState<SavedPhoto[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const storageKey = `lysto:closeout-draft:${jobId}`
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Draft | null
      if (stored) setDraft(stored)
    } catch {
      /* replace invalid draft */
    }
  }, [storageKey])
  const update = (values: Partial<Draft>) =>
    setDraft((current) => {
      const next = { ...current, ...values }
      sessionStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  async function submit() {
    const evidenceIds = [
      ...new Set([...draft.evidenceIds, ...saved.map((item) => item.upload.attachmentId)])
    ]
    const payload = {
      jobId,
      equipmentId,
      realDiagnosis: draft.diagnosis,
      workDone: draft.work,
      partsUsed: draft.parts
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
      resolutionStatus: draft.resolution,
      maintenanceOption: draft.maintenance,
      internalNotes: draft.notes || undefined,
      afterPhotoIds: evidenceIds
    }
    const fingerprint = JSON.stringify(payload),
      pending = recoverCommand(sessionStorage, `${jobId}:closeout`, fingerprint)
    setBusy(true)
    setMessage('Confirmando el cierre…')
    try {
      const response = await fetch('/api/jobs/final-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idempotencyKey: pending.key })
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      acknowledgeCommand(sessionStorage, `${jobId}:closeout`, pending.key)
      sessionStorage.removeItem(storageKey)
      setMessage('Informe confirmado y guardado.')
      onCompleted()
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : 'No se pudo confirmar.'} Conservamos el intento para consultar y reintentar sin duplicar.`
      )
    } finally {
      setBusy(false)
    }
  }
  const evidenceCount = new Set([
    ...draft.evidenceIds,
    ...saved.map((item) => item.upload.attachmentId)
  ]).size
  const pendingFollowup = ['pending_part', 'second_visit_required', 'not_resolved'].includes(
    draft.resolution
  )
  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-xl font-bold">Cierre técnico</h2>
      <p className="text-sm text-slate-600">
        El cliente confirmará el resultado después. Este paso crea el informe, historial y
        comprobante en una sola operación.
      </p>
      <Field label="Diagnóstico final">
        <Textarea value={draft.diagnosis} onChange={(e) => update({ diagnosis: e.target.value })} />
      </Field>
      <Field label="Trabajo realizado">
        <Textarea value={draft.work} onChange={(e) => update({ work: e.target.value })} />
      </Field>
      <Field
        label={
          pendingFollowup
            ? 'Repuesto o seguimiento pendiente'
            : 'Repuestos utilizados, uno por línea'
        }
      >
        <Textarea value={draft.parts} onChange={(e) => update({ parts: e.target.value })} />
      </Field>
      <Field label="Resultado">
        <select
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
          value={draft.resolution}
          onChange={(e) => update({ resolution: e.target.value })}
        >
          <option value="resolved">Resuelto</option>
          <option value="partially_resolved">Parcialmente resuelto</option>
          <option value="pending_part">Pendiente de repuesto</option>
          <option value="second_visit_required">Requiere segunda visita</option>
          <option value="not_resolved">No resuelto</option>
        </select>
      </Field>
      <Field label="Seguimiento recomendado">
        <select
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
          value={draft.maintenance}
          onChange={(e) => update({ maintenance: e.target.value })}
        >
          <option value="none">Sin seguimiento</option>
          <option value="filters_30_days">Filtros en 30 días</option>
          <option value="deep_cleaning_6_months">Limpieza en 6 meses</option>
          <option value="gas_review_30_days">Revisión de gas en 30 días</option>
          <option value="electrical_review">Revisión eléctrica</option>
          <option value="pending_part_replacement">Cambio de repuesto pendiente</option>
          <option value="second_visit_recommended">Segunda visita</option>
        </select>
      </Field>
      <Field label="Notas internas">
        <Input value={draft.notes} onChange={(e) => update({ notes: e.target.value })} />
      </Field>
      <MediaUploader
        files={files}
        onFilesChange={setFiles}
        savedPhotos={saved}
        onSavedPhotosChange={(photos) => {
          setSaved(photos)
          update({
            evidenceIds: [
              ...new Set([...draft.evidenceIds, ...photos.map((item) => item.upload.attachmentId)])
            ]
          })
        }}
        onBusyChange={setBusy}
        target={{ kind: 'job-photo', entityId: jobId, phase: 'after' }}
      />
      <p className="text-xs text-slate-500">
        Fotos posteriores verificadas: {evidenceCount}. Se exige al menos una.
      </p>
      {message ? (
        <p role="status" className="text-sm text-blue-800">
          {message}
        </p>
      ) : null}
      <Button
        disabled={
          busy ||
          draft.diagnosis.trim().length < 8 ||
          draft.work.trim().length < 8 ||
          evidenceCount < 1 ||
          (pendingFollowup && draft.parts.trim().length < 8)
        }
        onClick={() => void submit()}
      >
        Terminar trabajo y pedir conformidad
      </Button>
    </Card>
  )
}
