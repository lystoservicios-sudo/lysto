'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { paymentResponse } from './payment-response'

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
      <p className="mt-2 text-sm">Pago de $ 1.000 ARS: $ 180 para Lysto y $ 820 para el técnico asignado, antes de cargos de Mercado Pago.</p>
      <p className="mt-1 text-sm">Al continuar se abre Mercado Pago. Solo se cobra si confirmás el pago allí.</p>
      <Button className="mt-4" disabled={busy} onClick={() => void start()}>
        {busy ? 'Abriendo Mercado Pago…' : 'Pagar $ 1.000 con Mercado Pago'}
      </Button>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  )
}
