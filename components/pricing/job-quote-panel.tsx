'use client'
import { useEffect, useState } from 'react'
import { jobStatusLabels } from '@/lib/domain/job-status-labels'
import type { JobStatus } from '@/lib/domain/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'
import { MediaUploader, type SavedPhoto } from '@/components/customer/media-uploader'
import type { ServiceQuote } from '@/lib/pricing/service-quote'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'
import { QuoteBreakdown } from './quote-breakdown'
import { PaymentPanel } from '@/components/payments/payment-panel'
import { JobCloseoutForm } from '@/components/pro/job-closeout-form'
import {
  JobVisitCard,
  type CustomerJobVisit,
  type RescheduleRequest
} from '@/components/customer/job-visit-card'

type Extra = { id: string; fault: string; description: string; amount: number; status: string }
type Diagnosis = {
  id: string
  actual_diagnosis: string
  base_scope: string
  evidence_ids: string[]
  status: string
  version: number
  decision_reason: string | null
}
type JobData = {
  role: string
  job: { id: string; status: string }
  equipmentId: string | null
  visit: CustomerJobVisit | null
  onsiteDiagnosis: Diagnosis | null
  finalReport: {
    id: string
    real_diagnosis: string
    work_done: string
    parts_used: string | null
    final_state: string
    maintenance_option: string
    after_photo_ids: string[]
    version: number
    created_at: string
  } | null
  savedQuote: {
    status: string
    quote: ServiceQuote
    address: { street: string; number: string; floor?: string; apartment?: string; city: string }
  } | null
  extras: Extra[]
}

export function JobQuotePanel({ jobId, requestId }: { jobId?: string; requestId?: string }) {
  const [data, setData] = useState<JobData | null>(null),
    [message, setMessage] = useState('Cargando presupuesto…'),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false)
  const [fault, setFault] = useState(''),
    [description, setDescription] = useState(''),
    [amount, setAmount] = useState('')
  const [actualDiagnosis, setActualDiagnosis] = useState(''),
    [baseScope, setBaseScope] = useState(''),
    [decisionReason, setDecisionReason] = useState('')
  const [files, setFiles] = useState<File[]>([]),
    [saved, setSaved] = useState<SavedPhoto[]>([]),
    [savedEvidence, setSavedEvidence] = useState<string[]>([])
  useEffect(() => {
    let active = true
    fetch(
      `/api/pricing/job?${jobId ? `jobId=${encodeURIComponent(jobId)}` : `requestId=${encodeURIComponent(requestId ?? '')}`}`
    )
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error)
        if (active) {
          setData(body)
          setMessage('')
        }
      })
      .catch((error) => {
        if (active) {
          setData(null)
          setMessage(error.message)
        }
      })
    return () => {
      active = false
    }
  }, [jobId, requestId, revision])
  const currentJobId = data?.job.id
  useEffect(() => {
    if (!currentJobId) return
    const key = `lysto:onsite-draft:${currentJobId}`
    try {
      const draft = JSON.parse(sessionStorage.getItem(key) ?? 'null') as {
        actualDiagnosis?: string
        baseScope?: string
        evidenceIds?: string[]
      } | null
      if (draft) {
        setActualDiagnosis(draft.actualDiagnosis ?? '')
        setBaseScope(draft.baseScope ?? '')
        setSavedEvidence(draft.evidenceIds ?? [])
      }
    } catch {
      /* ignore invalid device draft */
    }
  }, [currentJobId])
  function saveDraft(next = { actualDiagnosis, baseScope, evidenceIds: savedEvidence }) {
    if (!data) return
    sessionStorage.setItem(`lysto:onsite-draft:${data.job.id}`, JSON.stringify(next))
  }
  async function command(
    url: string,
    method: string,
    scope: string,
    payload: Record<string, unknown>
  ) {
    if (!data || busy) return
    const fingerprint = JSON.stringify(payload),
      pending = recoverCommand(sessionStorage, `${data.job.id}:${scope}`, fingerprint)
    setBusy(true)
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idempotencyKey: pending.key })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      acknowledgeCommand(sessionStorage, `${data.job.id}:${scope}`, pending.key)
      setMessage('Operación confirmada por el servidor.')
      setRevision((value) => value + 1)
      return result
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : 'No se pudo confirmar.'} Se consultará el estado antes de reintentar.`
      )
      setRevision((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }
  async function propose() {
    if (!data) return
    const result = await command('/api/jobs/extras', 'POST', 'extra-proposal', {
      action: 'propose',
      jobId: data.job.id,
      fault,
      description,
      amount: Number(amount)
    })
    if (result) {
      setFault('')
      setDescription('')
      setAmount('')
    }
  }
  async function submitDiagnosis() {
    if (!data || !data.equipmentId) return
    const evidenceIds = [
      ...new Set([...savedEvidence, ...saved.map((item) => item.upload.attachmentId)])
    ]
    const draft = { actualDiagnosis, baseScope, evidenceIds }
    saveDraft(draft)
    const result = await command('/api/pricing/job/status', 'POST', 'diagnosis', {
      action: 'submitDiagnosis',
      jobId: data.job.id,
      expectedStatus: data.job.status,
      actualDiagnosis,
      baseScope,
      equipmentId: data.equipmentId,
      evidenceIds
    })
    if (result) {
      sessionStorage.removeItem(`lysto:onsite-draft:${data.job.id}`)
      setFiles([])
      setSaved([])
      setSavedEvidence([])
    }
  }
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-black">Presupuesto y adicionales</h1>
      {message ? (
        <p role="status" className="text-sm text-blue-800">
          {message}
        </p>
      ) : null}
      {data ? (
        <>
          <Card className="space-y-2 p-5">
            <p className="font-bold">
              Estado: {jobStatusLabels[data.job.status as JobStatus] ?? data.job.status}
            </p>
            {data.savedQuote ? (
              <p>
                {data.savedQuote.address.street} {data.savedQuote.address.number} ·{' '}
                {data.savedQuote.address.city}
              </p>
            ) : null}
            <p className="text-sm text-slate-600">
              El diagnóstico preliminar, el diagnóstico presencial y cada adicional conservan
              registros separados.
            </p>
          </Card>
          {data.role === 'customer' ? (
            <JobVisitCard
              jobId={data.job.id}
              visit={data.visit}
              onReschedule={async (request: RescheduleRequest) => {
                await command('/api/jobs/reschedule', 'POST', 'reschedule-request', {
                  action: 'request',
                  jobId: data.job.id,
                  ...request
                })
              }}
            />
          ) : null}
          {data.savedQuote ? (
            <QuoteBreakdown
              quote={data.savedQuote.quote}
              internal={data.role !== 'customer'}
              status={data.savedQuote.status}
            />
          ) : null}
          <PaymentPanel
            jobId={data.job.id}
            jobStatus={data.job.status}
            role={data.role}
            extras={data.extras}
          />
          {data.role === 'professional' && data.job.status === 'in_progress' && data.equipmentId ? (
            <JobCloseoutForm
              jobId={data.job.id}
              equipmentId={data.equipmentId}
              initialDiagnosis={data.onsiteDiagnosis?.actual_diagnosis}
              onCompleted={() => setRevision((value) => value + 1)}
            />
          ) : null}
          {data.finalReport ? (
            <Card className="space-y-2 p-5">
              <h2 className="text-xl font-bold">Informe técnico confirmado</h2>
              <p>
                <strong>Diagnóstico:</strong> {data.finalReport.real_diagnosis}
              </p>
              <p>
                <strong>Trabajo:</strong> {data.finalReport.work_done}
              </p>
              <p className="text-sm text-slate-600">
                Resultado: {data.finalReport.final_state} · Evidencias:{' '}
                {data.finalReport.after_photo_ids.length} · Versión {data.finalReport.version}
              </p>
            </Card>
          ) : null}
          {data.role === 'professional' &&
          ['confirmed', 'technician_on_way', 'arrived'].includes(data.job.status) ? (
            <Button
              disabled={busy}
              onClick={() =>
                void command('/api/pricing/job/status', 'POST', `advance:${data.job.status}`, {
                  action: 'advance',
                  jobId: data.job.id,
                  expectedStatus: data.job.status
                })
              }
            >
              {
                {
                  confirmed: 'Marcar en camino',
                  technician_on_way: 'Confirmar llegada',
                  arrived: 'Iniciar diagnóstico'
                }[data.job.status]
              }
            </Button>
          ) : null}
          {data.role === 'professional' &&
          (data.job.status === 'onsite_diagnosis' ||
            data.onsiteDiagnosis?.status === 'changes_requested') ? (
            <Card className="space-y-4 p-5">
              <h2 className="text-xl font-bold">Diagnóstico presencial</h2>
              {data.onsiteDiagnosis?.decision_reason ? (
                <p className="rounded-xl bg-amber-50 p-3 text-sm">
                  Cambios pedidos: {data.onsiteDiagnosis.decision_reason}
                </p>
              ) : null}
              <Field label="Diagnóstico verificado">
                <Textarea
                  value={actualDiagnosis}
                  onChange={(event) => {
                    setActualDiagnosis(event.target.value)
                    saveDraft({
                      actualDiagnosis: event.target.value,
                      baseScope,
                      evidenceIds: savedEvidence
                    })
                  }}
                />
              </Field>
              <Field label="Alcance base que se realizará">
                <Textarea
                  value={baseScope}
                  onChange={(event) => {
                    setBaseScope(event.target.value)
                    saveDraft({
                      actualDiagnosis,
                      baseScope: event.target.value,
                      evidenceIds: savedEvidence
                    })
                  }}
                />
              </Field>
              <MediaUploader
                files={files}
                onFilesChange={setFiles}
                savedPhotos={saved}
                onSavedPhotosChange={(photos) => {
                  setSaved(photos)
                  const ids = [
                    ...new Set([
                      ...savedEvidence,
                      ...photos.map((item) => item.upload.attachmentId)
                    ])
                  ]
                  setSavedEvidence(ids)
                  saveDraft({ actualDiagnosis, baseScope, evidenceIds: ids })
                }}
                onBusyChange={setBusy}
                target={{ kind: 'job-photo', entityId: data.job.id, phase: 'during' }}
              />
              <p className="text-xs text-slate-500">
                {savedEvidence.length + saved.length} evidencia(s) preparada(s). El equipo vinculado
                debe estar verificado.
              </p>
              <Button
                disabled={
                  busy ||
                  !data.equipmentId ||
                  actualDiagnosis.trim().length < 10 ||
                  baseScope.trim().length < 10 ||
                  new Set([...savedEvidence, ...saved.map((item) => item.upload.attachmentId)])
                    .size < 1
                }
                onClick={() => void submitDiagnosis()}
              >
                Enviar diagnóstico y alcance
              </Button>
            </Card>
          ) : null}
          {data.onsiteDiagnosis ? (
            <Card className="space-y-3 p-5">
              <h2 className="text-xl font-bold">Diagnóstico presencial compartido</h2>
              <p>
                <strong>Hallazgo:</strong> {data.onsiteDiagnosis.actual_diagnosis}
              </p>
              <p>
                <strong>Alcance base:</strong> {data.onsiteDiagnosis.base_scope}
              </p>
              <p className="text-sm">
                Evidencias verificadas: {data.onsiteDiagnosis.evidence_ids.length} · Estado:{' '}
                {data.onsiteDiagnosis.status}
              </p>
              {data.role === 'customer' && data.onsiteDiagnosis.status === 'submitted' ? (
                <>
                  <Field label="Cambios que necesitás">
                    <Input
                      value={decisionReason}
                      onChange={(event) => setDecisionReason(event.target.value)}
                    />
                  </Field>
                  <div className="flex gap-3">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void command('/api/pricing/job/status', 'POST', 'scope-decision', {
                          action: 'decideScope',
                          jobId: data.job.id,
                          decision: 'accepted',
                          expectedVersion: data.onsiteDiagnosis!.version
                        })
                      }
                    >
                      Aceptar e iniciar trabajo
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || decisionReason.trim().length < 10}
                      onClick={() =>
                        void command('/api/pricing/job/status', 'POST', 'scope-decision', {
                          action: 'decideScope',
                          jobId: data.job.id,
                          decision: 'changes_requested',
                          reason: decisionReason,
                          expectedVersion: data.onsiteDiagnosis!.version
                        })
                      }
                    >
                      Pedir cambios
                    </Button>
                  </div>
                </>
              ) : null}
            </Card>
          ) : null}
          <Card className="space-y-4 p-5">
            <h2 className="text-xl font-bold">Fallas adicionales</h2>
            <p className="text-sm text-slate-600">
              El presupuesto original no cambia. El adicional tiene comisión Lysto $0, exige
              aceptación y, por seguridad, pago confirmado antes de iniciar ese alcance.
            </p>
            {data.extras.map((extra) => (
              <div key={extra.id} className="space-y-2 border-t pt-4">
                <h3 className="font-bold">
                  {extra.fault} · $ {extra.amount.toLocaleString('es-AR')}
                </h3>
                <p>{extra.description}</p>
                <p className="text-xs font-semibold">{extra.status}</p>
                {data.role === 'customer' && extra.status === 'proposed' ? (
                  <div className="flex gap-3">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void command('/api/jobs/extras', 'PATCH', `extra:${extra.id}`, {
                          action: 'decide',
                          extraId: extra.id,
                          decision: 'accepted'
                        })
                      }
                    >
                      Aceptar adicional
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void command('/api/jobs/extras', 'PATCH', `extra:${extra.id}`, {
                          action: 'decide',
                          extraId: extra.id,
                          decision: 'rejected'
                        })
                      }
                    >
                      Rechazar adicional
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {!data.extras.length ? (
              <p className="text-sm text-slate-500">No hay adicionales registrados.</p>
            ) : null}
            {data.role === 'professional' &&
            ['arrived', 'onsite_diagnosis', 'waiting_customer_approval'].includes(
              data.job.status
            ) ? (
              <div className="space-y-3 border-t pt-4">
                <Field label="Nueva falla detectada">
                  <Input value={fault} onChange={(event) => setFault(event.target.value)} />
                </Field>
                <Field label="Trabajo adicional y materiales">
                  <Input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
                <Field label="Importe adicional">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </Field>
                <Button
                  disabled={
                    busy ||
                    fault.trim().length < 5 ||
                    description.trim().length < 10 ||
                    Number(amount) <= 0
                  }
                  onClick={() => void propose()}
                >
                  Registrar propuesta adicional
                </Button>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  )
}
