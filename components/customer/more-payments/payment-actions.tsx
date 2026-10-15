'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, RefreshCw, CreditCard } from 'lucide-react'
import { paymentResponse } from '@/components/payments/payment-response'
import { moreStyles as styles } from '@/components/customer/more/more-ui'
import { paymentCurrency } from '@/lib/customer-more/payments-model'

type Checkout = { id: string; status: string; expiresAt: string; liveMode: boolean; closedForNewPayments?: boolean }
export function MorePaymentActions({ customerId, jobId, jobStatus, amount, extraId, checkout, payEnabled = true }: {
  customerId: string; jobId: string; jobStatus: string; amount: number | null; extraId?: string; checkout?: Checkout; payEnabled?: boolean
}) {
  const router = useRouter()
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const payableJob = payEnabled && ['confirmed', 'technician_on_way', 'arrived', 'onsite_diagnosis',
    'waiting_customer_approval', 'in_progress', 'completed_pending_customer_confirmation', 'completed'].includes(jobStatus)
  const payable = payableJob && amount !== null && amount > 0 && (!checkout || (
    checkout.liveMode && !checkout.closedForNewPayments && ['ready', 'rejected', 'cancelled', 'creating'].includes(checkout.status) &&
    Date.parse(checkout.expiresAt) > Date.now()
  ))
  async function act(kind: 'pay' | 'reconcile') {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch(kind === 'pay' ? '/api/mercadopago/create-preference' : '/api/mercadopago/checkouts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lysto-Customer-Id': customerId },
        body: JSON.stringify(kind === 'pay' ? { jobId, ...(extraId ? { extraId } : {}) } : { checkoutId: checkout!.id, action: 'reconcile' })
      })
      const result = await paymentResponse(response)
      if (kind === 'pay' && result.initPoint) {
        const destination = new URL(result.initPoint)
        if (destination.protocol !== 'https:' || !/^(www\.)?mercadopago\.com(\.ar)?$/.test(destination.hostname)) throw new Error('No pudimos abrir Mercado Pago. Consultá el estado antes de reintentar.')
        window.location.assign(destination.toString())
      } else {
        setMessage(result.updated === false ? 'La consulta todavía está en proceso. Volvé a consultar en unos instantes.' : 'Estado actualizado con la información confirmada.')
        router.refresh()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos consultar el pago. Intentá nuevamente.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return <div>
    <div className={styles.actions}>
      {payable ? <button type="button" className={styles.primary} disabled={busy} onClick={() => void act('pay')}>
        <CreditCard size={18} aria-hidden="true" />{busy ? 'Procesando…' : `Pagar ${paymentCurrency(amount!)} con Mercado Pago`}
      </button> : null}
      {checkout ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => void act('reconcile')}>
        <RefreshCw size={18} aria-hidden="true" />{busy ? 'Consultando…' : 'Consultar estado'}
      </button> : null}
    </div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {message ? <p className={styles.notice} role="status">{message}</p> : null}
  </div>
}
export function PrintPaymentRecord() {
  return <button type="button" className={styles.secondary} onClick={() => window.print()}>
    <Printer size={18} aria-hidden="true" />Imprimir o guardar PDF
  </button>
}
