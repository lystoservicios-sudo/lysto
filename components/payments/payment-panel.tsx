'use client'
import { useEffect, useState } from 'react'
import { paymentResponse } from './payment-response'
import { Card } from '@/components/ui/card'
import { Button, ButtonLink } from '@/components/ui/button'
import { paymentStatusLabels } from '@/lib/payments/checkout-contract'

type Checkout = {
  id: string
  job_id: string
  extra_id: string | null
  amount: string
  marketplace_fee: string
  professional_amount: string
  status: string
  live_mode: boolean
  expires_at: string
  review_reason: string | null
  observations: Array<{
    paymentId: string
    status: string
    providerFee: number
    netReceived: number | null
    refunded: number
  }>
}
const ars = (n: string | number) =>
  Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
export function PaymentPanel({
  jobId,
  jobStatus,
  role,
  extras = []
}: {
  jobId?: string
  jobStatus?: string
  role?: string
  extras?: Array<{ id: string; fault: string; amount: number; status: string }>
}) {
  const [rows, setRows] = useState<Checkout[]>([]),
    [actor, setActor] = useState(role),
    [message, setMessage] = useState('Cargando pagos…'),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    fetch(`/api/mercadopago/checkouts${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`)
      .then(async (r) => {
        const b = await paymentResponse(r)
        if (active) {
          setRows(b.checkouts)
          setActor(b.role)
          setMessage('')
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message)
      })
    return () => {
      active = false
    }
  }, [jobId, revision])
  async function pay(extraId?: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, extraId })
      })
      const b = await paymentResponse(r)
      if (b.initPoint) window.location.assign(b.initPoint)
      else {
        setRevision((n) => n + 1)
        setMessage('El pago ya está registrado.')
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo preparar el pago.')
    } finally {
      setBusy(false)
    }
  }
  async function refresh(id: string, action = 'reconcile') {
    setBusy(true)
    try {
      const r = await fetch('/api/mercadopago/checkouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutId: id, action })
      })
      await paymentResponse(r)
      setRevision((n) => n + 1)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo actualizar el estado.')
    } finally {
      setBusy(false)
    }
  }
  async function close(id: string) {
    setBusy(true)
    try {
      await paymentResponse(
        await fetch('/api/payments/refund-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'closeCheckout', checkoutId: id })
        })
      )
      setRevision((n) => n + 1)
      setMessage('El enlace quedó cerrado y verificado en Mercado Pago.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo cerrar el enlace.')
    } finally {
      setBusy(false)
    }
  }
  const payableJob =
    jobId &&
    !['pending_assignment', 'pending_professional_acceptance'].includes(
      jobStatus ?? 'pending_assignment'
    ) &&
    !jobStatus?.startsWith('cancelled')
  const targets = [
    { id: null as string | null, label: 'Servicio presupuestado' },
    ...extras
      .filter((e) => e.status === 'accepted')
      .map((e) => ({ id: e.id, label: `Adicional: ${e.fault}` }))
  ]
  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Pagos con Mercado Pago</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            El precio acordado ya incluye el 30% de protección. Al pagar no se vuelve a sumar. La
            confirmación se verifica con Mercado Pago; volver a esta página no significa que el pago
            esté aprobado.
          </p>
        </div>
        {actor === 'professional' ? (
          <ButtonLink href="/pro/mercadopago" variant="secondary">
            Mi cuenta de cobro
          </ButtonLink>
        ) : null}
        {actor === 'admin' ? (
          <ButtonLink href="/admin/calculadora" variant="secondary">
            Configurar comisión
          </ButtonLink>
        ) : null}
      </div>
      {message ? (
        <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          {message}
        </p>
      ) : null}
      {jobId && actor === 'customer' && !payableJob ? (
        <p className="text-sm">El pago se habilita cuando el profesional acepta el trabajo.</p>
      ) : null}
      {jobId && actor === 'customer' && payableJob
        ? targets.map((target) => {
            const c = rows.find((r) => r.extra_id === target.id)
            const allowed = !c || ['creating', 'ready', 'rejected', 'cancelled'].includes(c.status)
            return (
              <div
                key={target.id ?? 'service'}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"
              >
                <p className="font-semibold">{target.label}</p>
                <Button
                  disabled={busy || !allowed || (!!c && Date.parse(c.expires_at) <= Date.now())}
                  onClick={() => void pay(target.id ?? undefined)}
                >
                  {c?.status === 'approved'
                    ? 'Pagado'
                    : allowed
                      ? 'Pagar con Mercado Pago'
                      : (paymentStatusLabels[c?.status ?? ''] ?? 'Consultar estado')}
                </Button>
              </div>
            )
          })
        : null}
      {!rows.length && !message ? (
        <p className="text-sm text-slate-500">Todavía no hay pagos registrados.</p>
      ) : null}
      {rows.map((c) => (
        <article key={c.id} className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap justify-between gap-2">
            <h3 className="font-bold">
              {c.extra_id ? 'Adicional sin comisión Lysto' : 'Servicio inicial'} · {ars(c.amount)}
            </h3>
            <span className="text-sm font-bold">
              {paymentStatusLabels[c.status] ?? c.status}
              {!c.live_mode ? ' · Prueba' : ''}
            </span>
          </div>
          {actor !== 'customer' ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                Comisión Lysto: <strong>{ars(c.marketplace_fee)}</strong>
              </div>
              <div>
                Profesional antes de cargos: <strong>{ars(c.professional_amount)}</strong>
              </div>
            </dl>
          ) : null}
          {c.observations.map((p) => (
            <div key={p.paymentId} className="rounded-xl bg-slate-50 p-3 text-sm">
              <p>
                Pago {p.paymentId} · {paymentStatusLabels[p.status] ?? p.status}
              </p>
              {actor !== 'customer' ? (
                <p>
                  Cargos informados por Mercado Pago: {ars(p.providerFee)} · Neto informado:{' '}
                  {p.netReceived === null ? 'Pendiente' : ars(p.netReceived)}
                </p>
              ) : null}
              {Number(p.refunded) > 0 ? <p>Reembolsado: {ars(p.refunded)}</p> : null}
            </div>
          ))}
          {c.status === 'review' ? (
            <p className="text-sm text-amber-900">
              Hay una diferencia que debe revisar el equipo. No vuelvas a pagar.
              {actor === 'admin' ? ` Motivo: ${c.review_reason}` : ''}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void refresh(c.id)}>
              Consultar estado en Mercado Pago
            </Button>
            {actor === 'admin' &&
            Date.parse(c.expires_at) <= Date.now() &&
            ['ready', 'expired', 'rejected', 'cancelled'].includes(c.status) ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void refresh(c.id, 'renew')}
              >
                Renovar enlace vencido
              </Button>
            ) : null}
            {actor === 'admin' &&
            ['ready', 'expired', 'rejected', 'cancelled', 'review'].includes(c.status) ? (
              <Button variant="secondary" disabled={busy} onClick={() => void close(c.id)}>
                Cerrar enlace para cancelación
              </Button>
            ) : null}
            {!jobId ? (
              <ButtonLink
                href={`/${actor === 'customer' ? 'app' : actor === 'professional' ? 'pro' : 'admin/calculadora'}/trabajos/${c.job_id}`}
                variant="ghost"
              >
                Ver trabajo
              </ButtonLink>
            ) : null}
          </div>
        </article>
      ))}
    </Card>
  )
}
