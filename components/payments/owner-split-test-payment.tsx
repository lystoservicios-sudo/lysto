'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { paymentResponse } from './payment-response'
import { OWNER_MAINTENANCE_TEST_PRICE, MARKETPLACE_COMMISSION_RATE } from '@/lib/pricing/owner-maintenance-test-price'

const total = OWNER_MAINTENANCE_TEST_PRICE
const platformFee = total * MARKETPLACE_COMMISSION_RATE
const professionalAmount = total - platformFee

export function OwnerSplitTestPayment() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function start() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/mercadopago/owner-split-test', { method: 'POST' })
      const result = await paymentResponse(response)
      if (result.initPoint) window.location.assign(result.initPoint)
      else setError('El pago ya figura registrado. Revisá Pagos y movimientos.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el pago.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5" aria-labelledby="split-test-title">
      <h2 id="split-test-title" className="text-xl font-bold">Prueba real del split</h2>
      <p className="mt-2 text-sm">Pago de $ {total} ARS: $ {platformFee} para Lysto y $ {professionalAmount} para el técnico asignado, antes de cargos de Mercado Pago.</p>
      <p className="mt-1 text-sm">Al continuar se abre Mercado Pago. Solo se cobra si confirmás el pago allí.</p>
      <Button className="mt-4" disabled={busy} onClick={() => void start()}>
        {busy ? 'Abriendo Mercado Pago…' : `Pagar $ ${total} con Mercado Pago`}
      </Button>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  )
}
