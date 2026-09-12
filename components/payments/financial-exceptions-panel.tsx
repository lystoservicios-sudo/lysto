'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  canOperate
}: {
  canFinance: boolean
  canOperate: boolean
}) {
  const [data, setData] = useState<{
    cases: Case[]
    refunds: Refund[]
    refundablePayments: Payment[]
  }>({ cases: [], refunds: [], refundablePayments: [] })
  const [message, setMessage] = useState('Cargando excepciones financieras…'),
    [busy, setBusy] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const load = useCallback(
    () =>
      fetch('/api/payments/refund-requests')
        .then(paymentResponse)
        .then((body) => {
          setData(body)
          setMessage('')
        })
        .catch((error) => setMessage(error.message)),
    []
  )
  useEffect(() => {
    void load()
  }, [load])
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))
  async function post(url: string, body: unknown) {
    setBusy(true)
    try {
      await paymentResponse(
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      )
      setMessage('Operación registrada.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.')
    } finally {
      setBusy(false)
    }
  }
  async function requestRefund(event: FormEvent, payment: Payment) {
    event.preventDefault()
    await post('/api/payments/refund-requests', {
      action: 'requestRefund',
      paymentId: payment.id,
      amount: Number(values[`amount:${payment.id}`] ?? payment.availableAmount),
      reason: values[`reason:${payment.id}`] ?? '',
      idempotencyKey: crypto.randomUUID()
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
            <h2 className="text-xl font-bold">Abrir excepción de servicio</h2>
            <p className="text-sm text-slate-600">
              Si existe un enlace de pago, el trabajo queda en revisión hasta que finanzas cierre el
              riesgo de cobro.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[2fr_100px_2fr_auto_auto]">
            <input
              className="rounded-lg border px-3"
              placeholder="ID del trabajo"
              value={values.jobId ?? ''}
              onChange={(e) => set('jobId', e.target.value)}
            />
            <input
              className="rounded-lg border px-3"
              type="number"
              min="0"
              placeholder="Versión"
              value={values.jobVersion ?? '0'}
              onChange={(e) => set('jobVersion', e.target.value)}
            />
            <input
              className="rounded-lg border px-3"
              placeholder="Motivo operativo documentado"
              value={values.jobReason ?? ''}
              onChange={(e) => set('jobReason', e.target.value)}
            />
            <Button
              disabled={busy}
              onClick={() =>
                void post('/api/jobs/cancel', {
                  action: 'cancel',
                  jobId: values.jobId,
                  reason: values.jobReason,
                  expectedVersion: Number(values.jobVersion)
                })
              }
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void post('/api/jobs/cancel', {
                  action: 'replaceProfessional',
                  jobId: values.jobId,
                  reason: values.jobReason,
                  expectedVersion: Number(values.jobVersion)
                })
              }
            >
              Sustituir profesional
            </Button>
          </div>
        </Card>
      ) : null}
      {canFinance ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-xl font-bold">Reintegros disponibles</h2>
            <p className="text-sm text-slate-600">
              La solicitud reserva saldo. El worker confirma el reintegro con Mercado Pago antes de
              marcarlo exitoso.
            </p>
          </div>
          {data.refundablePayments.map((payment) => (
            <form
              key={payment.id}
              className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_160px_2fr_auto]"
              onSubmit={(event) => void requestRefund(event, payment)}
            >
              <div>
                <strong>Trabajo {payment.jobId ?? 'sin trabajo'}</strong>
                <p className="text-sm">
                  Disponible {ars(payment.availableAmount)} de {ars(payment.amount)}
                </p>
              </div>
              <input
                className="rounded-lg border px-3"
                type="number"
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
                value={values[`reason:${payment.id}`] ?? ''}
                onChange={(e) => set(`reason:${payment.id}`, e.target.value)}
              />
              <Button disabled={busy || payment.availableAmount <= 0}>Solicitar reintegro</Button>
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
                {item.jobId}
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
                Trabajo {refund.jobId ?? '—'} · intento {refund.attemptCount}
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
    </div>
  )
}
