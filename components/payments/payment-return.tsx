'use client'

import { useEffect, useState } from 'react'
import { Check, Clock3, ShieldCheck } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { paymentCurrency, paymentState } from '@/lib/customer-more/payments-model'
import type { CustomerPaymentResult } from '@/lib/customer-more/payments'

function verified(result: CustomerPaymentResult) {
  return result.status === 'approved' && result.providerReferences.length > 0
}
const finalStates = new Set(['approved', 'refunded', 'partially_refunded', 'charged_back', 'review'])

export function PaymentReturn({ checkoutId, returnToken, initialResult }: {
  checkoutId: string; returnToken?: string; initialResult?: CustomerPaymentResult | null
}) {
  const [result, setResult] = useState<CustomerPaymentResult | null>(initialResult ?? null)
  const [busy, setBusy] = useState(!initialResult)
  const [accessRequired, setAccessRequired] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const endpoint = returnToken ? '/api/payments/return' : '/api/customer/payment-result'
    const receiptHeaders = returnToken ? { Authorization: `Bearer ${returnToken}` } : undefined
    setBusy(true)
    setError('')
    setAccessRequired(false)
    async function read() {
      const response = await fetch(`${endpoint}?checkoutId=${encodeURIComponent(checkoutId)}`, {
        cache: 'no-store', signal: controller.signal, ...(receiptHeaders ? { headers: receiptHeaders } : {})
      })
      if (!returnToken && [401, 403, 404].includes(response.status)) throw new Error('access_required')
      if (!response.ok) throw new Error('verification_unavailable')
      return await response.json() as CustomerPaymentResult
    }
    async function load() {
      attempts += 1
      try {
        let current = await read()
        // The URL's status and payment_id are never used to establish payment.
        // First prove ownership, then reconcile through the authenticated API.
        if (!finalStates.has(current.status) || (current.status === 'approved' && !verified(current))) {
          const response = await fetch(returnToken ? `${endpoint}?checkoutId=${encodeURIComponent(checkoutId)}` : '/api/mercadopago/checkouts', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...receiptHeaders },
            body: JSON.stringify(returnToken ? {} : { checkoutId, action: 'reconcile_return' }), signal: controller.signal
          })
          if (!returnToken && [401, 403, 404].includes(response.status)) throw new Error('access_required')
          if (!response.ok) throw new Error('verification_unavailable')
          current = await read()
        }
        if (active) {
          setResult(current)
          if (returnToken && attempts < 5 && ['creating', 'ready', 'pending', 'in_process'].includes(current.status))
            retryTimer = setTimeout(() => { void load() }, 8000)
        }
      } catch (cause) {
        if (!active) return
        if (cause instanceof Error && cause.message === 'access_required') {
          setResult(null)
          setAccessRequired(true)
        } else setError('No pudimos verificar el pago en este momento.')
      } finally {
        if (active) setBusy(false)
      }
    }
    void load()
    return () => { active = false; controller.abort(); clearTimeout(retryTimer) }
  }, [checkoutId, revision, returnToken])

  if (accessRequired) return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <ShieldCheck className="h-10 w-10 text-lysto-blue" aria-hidden="true" />
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">Ver el detalle de tu pago</h1>
      <p className="mt-3 leading-7 text-slate-600">Ingresá en Lysto con el email que usaste al solicitar el servicio para consultar el resultado. Si ya pagaste, no necesitás volver a pagar.</p>
      <ButtonLink className="mt-6 h-auto min-h-12 w-full px-4 py-3 text-center" href={`/login?next=${encodeURIComponent(`/app/pagos/resultado/${checkoutId}`)}`}>
        Ingresar
      </ButtonLink>
    </section>
  )

  const confirmed = result ? verified(result) : false
  const state = result ? paymentState(result.status, result.expiresAt) : null
  const unsettled = !result || ['creating', 'ready', 'pending', 'in_process'].includes(result.status) || (result.status === 'approved' && !confirmed)
  const title = confirmed ? 'Gracias, tu pago está confirmado'
    : result?.status === 'pending' || result?.status === 'in_process' ? 'Tu pago está pendiente'
    : unsettled ? 'Estamos verificando tu pago' : state?.label ?? 'Consultá el estado de tu pago'
  const description = confirmed
    ? result?.extraId ? 'El pago del adicional quedó registrado en tu trabajo.' : 'El pago de tu servicio quedó registrado. Podés seguir los próximos pasos desde tu trabajo.'
    : unsettled ? 'Estamos consultando la confirmación de Mercado Pago. Si ya pagaste, no vuelvas a pagar.' : state?.description
  const Icon = confirmed ? Check : Clock3
  const visit = result?.scheduledDate
    ? `${new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(result.scheduledDate))}${result.timeWindow ? ` · ${result.timeWindow}` : ''}`
    : 'A coordinar'

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white" aria-busy={busy}>
      <div className="px-6 pb-6 pt-8 text-center sm:px-8">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-lysto-blue'}`}>
          <Icon className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div aria-live="polite">
          <h1 className="mt-5 text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
        </div>
        {busy && <p role="status" className="mt-3 text-sm text-slate-500">Consultando el estado…</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      </div>
      {result && (
        <div className="mx-6 border-y border-slate-100 py-6 sm:mx-8">
          {!result.liveMode && <p className="mb-3 text-sm font-semibold text-amber-800">Pago de prueba</p>}
          <p className="text-center text-sm text-slate-500">{confirmed ? 'Importe pagado' : 'Importe del pago'}</p>
          <p className="mt-1 text-center text-4xl font-bold tracking-tight text-slate-950">{paymentCurrency(result.amount)}</p>
          <dl className="mt-6 space-y-4 text-sm">
            <Summary label={result.extraId ? 'Adicional contratado' : 'Servicio contratado'} value={result.extraLabel ?? result.service} />
            {result.extraId && <Summary label="Servicio" value={result.service} />}
            <Summary label="Profesional" value={result.professional} />
            <Summary label="Visita" value={visit} />
            {result.providerReferences.length > 0 && <Summary label="Operación de Mercado Pago" value={result.providerReferences.join(', ')} />}
          </dl>
          {result.extraId && result.lystoFee === 0 && <p className="mt-5 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">Comisión de Lysto: $0</p>}
        </div>
      )}
      <div className="space-y-3 p-6 sm:p-8">
        {!confirmed && <Button variant="secondary" className="w-full" disabled={busy} onClick={() => setRevision(value => value + 1)}>Actualizar estado</Button>}
        {result && !returnToken && <ButtonLink className="min-h-12 w-full" href={`/app/trabajos/${result.jobId}`}>Ver mi trabajo</ButtonLink>}
        <ButtonLink className="min-h-12 w-full" variant={returnToken ? 'primary' : 'secondary'} href={returnToken ? '/' : '/app'}>Ir al inicio</ButtonLink>
        {confirmed && result && !returnToken && <a className="flex min-h-11 items-center justify-center text-sm font-semibold text-lysto-blue underline underline-offset-4" href={`/app/pagos/${result.jobId}`}>Ver registro del pago</a>}
      </div>
    </section>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
    <dt className="text-slate-500">{label}</dt>
    <dd className="break-words font-semibold text-slate-900 sm:max-w-[65%] sm:text-right">{value}</dd>
  </div>
}
