'use client'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'
import { paymentJobLabel, type AdminPaymentJob } from './admin-charge-panel'
import { paymentResponse } from './payment-response'

type Case = {
  id: string
  jobId: string
  kind: string
  status: string
  reason: string
  version: number
  createdAt: string
  replacementJobId: string | null
  checkoutCount: number
  openRefundCount: number
}
type Refund = {
  id: string
  paymentId: string
  jobId: string | null
  amount: number
  paymentAmount: number
  currency: string
  reason: string
  status: string
  attemptCount: number
  lastError: string | null
  failureReason: string | null
  providerReference: string | null
  requestedAt: string
}
type Payment = {
  id: string
  jobId: string | null
  amount: number
  currency: string
  status: string
  reservedAmount: number
  availableAmount: number
}
const ars = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
export function FinancialExceptionsPanel({
  canFinance,
  canOperate,
  actorKey = 'admin'
}: {
  canFinance: boolean
  canOperate: boolean
  actorKey?: string
}) {
  const [data, setData] = useState<{
    cases: Case[]
    refunds: Refund[]
    refundablePayments: Payment[]
  }>({ cases: [], refunds: [], refundablePayments: [] })
  const [message, setMessage] = useState('Cargando excepciones financieras…'),
    [busy, setBusy] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [jobs, setJobs] = useState<AdminPaymentJob[]>([])
  const [search, setSearch] = useState(''), [lookup, setLookup] = useState('')
  const [confirmation, setConfirmation] = useState<{ url: string; body: Record<string, unknown> } | null>(null)
  const lock = useRef(false)
  const selectedJob = jobs.find(job => job.id === values.jobId)
  const jobLabel = (id: string | null) => {
    const job = jobs.find(item => item.id === id)
    return job ? paymentJobLabel(job) : `Servicio #${id?.slice(0, 8) ?? 'sin referencia'}`
  }
  const load = useCallback(
    () =>
      fetch('/api/payments/refund-requests').then(paymentResponse)
        .then(async body => {
          const ids = [...new Set<string>([...body.cases, ...body.refundablePayments, ...body.refunds]
            .map((item: { jobId: string | null }) => item.jobId).filter((id: string | null): id is string => Boolean(id)))]
          const query = new URLSearchParams({ search: lookup, jobIds: ids.join(',') })
          const context = await fetch(`/api/payments/admin-charges?${query}`).then(paymentResponse)
          setData(body); setJobs(context.jobs)
          setMessage('')
          return true
        })
        .catch((error) => { setMessage(error.message); return false }),
    [lookup]
  )
  useEffect(() => {
    void load()
  }, [load])
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))
  async function post(url: string, body: Record<string, unknown>) {
    setConfirmation({ url, body })
  }
  async function execute() {
    if (!confirmation || lock.current) return
    lock.current = true
    const { url, body } = confirmation
    setBusy(true)
    try {
      const scope = `admin-refund:${actorKey}:${String(body.paymentId)}`
      const command = body.action === 'requestRefund'
        ? recoverCommand(sessionStorage, scope, JSON.stringify(body)) : null
      await paymentResponse(
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(command ? { ...body, idempotencyKey: command.key } : body)
        })
      )
      if (command) acknowledgeCommand(sessionStorage, scope, command.key)
      setConfirmation(null)
      const refreshed = await load()
      const success = body.action === 'requestRefund'
        ? 'Solicitud de devolución registrada. Se mostrará como completada cuando Mercado Pago la confirme.'
        : 'Operación registrada. Revisá su estado actualizado.'
      setMessage(success + (refreshed ? '' : ' No pudimos actualizar la lista. Recargá la página antes de realizar otra operación.'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.')
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  async function requestRefund(event: FormEvent, payment: Payment) {
    event.preventDefault()
    await post('/api/payments/refund-requests', {
      action: 'requestRefund',
      paymentId: payment.id,
      amount: Number(values[`amount:${payment.id}`] ?? payment.availableAmount),
      reason: values[`reason:${payment.id}`] ?? '',
    })
  }
  return (
    <div className="space-y-5">
      {message ? (
        <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          {message}
        </p>
      ) : null}
      {canOperate ? (
        <Card className="space-y-3 p-5">
          <div>
            <h2 className="text-xl font-bold">Cancelaciones y cambios de profesional</h2>
            <p className="text-sm text-slate-600">
              Si existe un enlace de pago, el trabajo queda en revisión hasta que finanzas cierre el
              riesgo de cobro.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-0 flex-1 gap-1">Buscar servicio para cancelar<input maxLength={120} className="rounded-lg border p-3" placeholder="Cliente, profesional o referencia del servicio" value={search} onChange={e => setSearch(e.target.value)} /></label>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => { set('jobId', ''); setLookup(search.trim()) }}>Buscar servicios</Button>
          </div>
          <p className="text-xs text-slate-500">Hasta 100 resultados. Buscá por referencia para encontrar servicios antiguos.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-lg border px-3"
              aria-label="Servicio para cancelar o reasignar"
              value={values.jobId ?? ''}
              onChange={(e) => set('jobId', e.target.value)}
            ><option value="">Seleccionar servicio</option>{jobs.filter(job =>
              job.matchesSearch !== false && !job.status.startsWith('cancelled') && !['completed','completed_pending_customer_confirmation','refunded'].includes(job.status)
            ).map(job => <option key={job.id} value={job.id}>{paymentJobLabel(job)}</option>)}</select>
            <input
              className="rounded-lg border px-3"
              placeholder="Motivo operativo documentado"
              aria-label="Motivo de cancelación o cambio"
              value={values.jobReason ?? ''}
              onChange={(e) => set('jobReason', e.target.value)}
            />
            <Button
              disabled={busy || !selectedJob || (values.jobReason?.trim().length ?? 0) < 10}
              onClick={() =>
                void post('/api/jobs/cancel', {
                  action: 'cancel',
                  jobId: values.jobId,
                  reason: values.jobReason,
                  expectedVersion: selectedJob?.version
                })
              }
            >
              Revisar cancelación
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !selectedJob || !selectedJob.professionalName || (values.jobReason?.trim().length ?? 0) < 10}
              onClick={() =>
                void post('/api/jobs/cancel', {
                  action: 'replaceProfessional',
                  jobId: values.jobId,
                  reason: values.jobReason,
                  expectedVersion: selectedJob?.version
                })
              }
            >
              Revisar cambio de profesional
            </Button>
          </div>
        </Card>
      ) : null}
      {canFinance ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-xl font-bold">Devoluciones totales o parciales</h2>
            <p className="text-sm text-slate-600">
              Elegí el importe a devolver. Se reserva el saldo para evitar duplicados y se verifica
              la respuesta de Mercado Pago antes de confirmar la devolución.
            </p>
          </div>
          {data.refundablePayments.map((payment) => (
            <form
              key={payment.id}
              className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_160px_2fr_auto]"
              onSubmit={(event) => void requestRefund(event, payment)}
            >
              <div>
                <strong>{jobLabel(payment.jobId)}</strong>
                <p className="text-sm">
                  Disponible {ars(payment.availableAmount)} de {ars(payment.amount)}
                </p>
              </div>
              <input
                className="rounded-lg border px-3"
                type="number"
                aria-label={`Importe a devolver ${payment.id}`}
                min="0.01"
                max={payment.availableAmount}
                step="0.01"
                value={values[`amount:${payment.id}`] ?? String(payment.availableAmount)}
                onChange={(e) => set(`amount:${payment.id}`, e.target.value)}
              />
              <input
                className="rounded-lg border px-3"
                required
                minLength={10}
                maxLength={2000}
                placeholder="Motivo y autorización"
                aria-label={`Motivo de devolución ${payment.id}`}
                value={values[`reason:${payment.id}`] ?? ''}
                onChange={(e) => set(`reason:${payment.id}`, e.target.value)}
              />
              <Button disabled={busy || payment.availableAmount <= 0}>Revisar devolución</Button>
            </form>
          ))}
          {!data.refundablePayments.length ? (
            <p className="text-sm text-slate-500">No hay saldo elegible para reintegro.</p>
          ) : null}
        </Card>
      ) : null}
      <Card className="space-y-4 p-5">
        <h2 className="text-xl font-bold">Casos de cancelación y reemplazo</h2>
        {data.cases.map((item) => (
          <article key={item.id} className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>
                {item.kind === 'cancellation' ? 'Cancelación' : 'Sustitución'} · trabajo{' '}
                {jobLabel(item.jobId)}
              </strong>
              <span>{item.status}</span>
            </div>
            <p className="text-sm">{item.reason}</p>
            <p className="text-xs text-slate-500">
              Checkouts: {item.checkoutCount} · reintegros abiertos: {item.openRefundCount} ·
              versión {item.version}
            </p>
            {item.status === 'waiting_reconciliation' && canFinance ? (
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border px-3"
                  placeholder="Resumen de conciliación y evidencia"
                  value={values[`clear:${item.id}`] ?? ''}
                  onChange={(e) => set(`clear:${item.id}`, e.target.value)}
                />
                <Button
                  disabled={busy}
                  onClick={() =>
                    void post('/api/payments/refund-requests', {
                      action: 'clearCase',
                      caseId: item.id,
                      expectedVersion: item.version,
                      summary: values[`clear:${item.id}`] ?? ''
                    })
                  }
                >
                  Validar conciliación
                </Button>
              </div>
            ) : null}
            {item.status === 'ready' && canOperate ? (
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border px-3"
                  placeholder="Motivo de resolución operativa"
                  value={values[`resolve:${item.id}`] ?? ''}
                  onChange={(e) => set(`resolve:${item.id}`, e.target.value)}
                />
                <Button
                  disabled={busy}
                  onClick={() =>
                    void post('/api/jobs/cancel', {
                      action: 'resolveCase',
                      caseId: item.id,
                      expectedVersion: item.version,
                      reason: values[`resolve:${item.id}`] ?? ''
                    })
                  }
                >
                  Resolver caso
                </Button>
              </div>
            ) : null}
            {item.replacementJobId ? (
              <p className="text-sm">Trabajo reemplazante: {item.replacementJobId}</p>
            ) : null}
          </article>
        ))}
        {!data.cases.length ? (
          <p className="text-sm text-slate-500">No hay casos abiertos o resueltos.</p>
        ) : null}
      </Card>
      {canFinance ? (
        <Card className="space-y-3 p-5">
          <h2 className="text-xl font-bold">Historial de reintegros</h2>
          {data.refunds.map((refund) => (
            <div key={refund.id} className="rounded-xl border p-3 text-sm">
              <strong>
                {ars(refund.amount)} · {refund.status}
              </strong>
              <p>
                {jobLabel(refund.jobId)} · intento {refund.attemptCount}
              </p>
              <p>{refund.reason}</p>
              {refund.lastError ? (
                <p className="text-amber-800">Pendiente: {refund.lastError}</p>
              ) : null}
              {refund.failureReason ? (
                <p className="text-red-800">Falló: {refund.failureReason}</p>
              ) : null}
            </div>
          ))}
        </Card>
      ) : null}
      <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !busy) setConfirmation(null) }} title="Confirmar operación administrativa">
        {confirmation ? <div className="space-y-3">
          <p className="font-semibold">{({
            requestRefund: 'Devolver dinero al cliente', cancel: 'Solicitar cancelación del servicio',
            replaceProfessional: 'Solicitar cambio de profesional', clearCase: 'Validar conciliación',
            resolveCase: 'Resolver caso'
          } as Record<string, string>)[String(confirmation.body.action)] ?? 'Actualizar operación'}</p>
          {confirmation.body.jobId ? <p>{jobLabel(String(confirmation.body.jobId))}</p> : null}
          {confirmation.body.caseId ? <p>Caso #{String(confirmation.body.caseId).slice(0, 8)} · {jobLabel(data.cases.find(item => item.id === confirmation.body.caseId)?.jobId ?? null)}</p> : null}
          {confirmation.body.paymentId ? <>
            <p>{jobLabel(data.refundablePayments.find(payment => payment.id === confirmation.body.paymentId)?.jobId ?? null)}</p>
            <p>La devolución vuelve al medio de pago original del cliente.</p>
            <p>Importe a devolver: <strong>{ars(Number(confirmation.body.amount))}</strong></p>
          </> : null}
          <p>Motivo: {String(confirmation.body.reason ?? confirmation.body.summary ?? '')}</p>
          {confirmation.body.action === 'cancel' ? <p>Si existe un pago o enlace emitido, la cancelación queda pendiente de conciliación. No se devuelve dinero automáticamente.</p> : null}
          {message ? <p role="status">{message}</p> : null}
          <Button disabled={busy} onClick={() => void execute()}>{busy ? 'Registrando…' : 'Confirmar operación'}</Button>
        </div> : null}
      </Dialog>
    </div>
  )
}
