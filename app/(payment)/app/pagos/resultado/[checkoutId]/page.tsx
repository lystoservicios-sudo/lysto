import type { Metadata } from 'next'
import Link from 'next/link'
import { z } from 'zod'
import { PaymentReturn } from '@/components/payments/payment-return'
import { ButtonLink } from '@/components/ui/button'
import { readPaymentReturnReceipt } from '@/lib/payments/payment-return-receipt'
import { checkPaymentReturnToken } from '@/lib/payments/payment-return-token'
import { enforceRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Tu pago | Lysto',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
}

// Intentionally outside the customer layout: returning from the provider with
// another account or an expired session must offer recovery, not a generic 404.
// A signed provider return authorizes only this receipt, independent of account
// roles. Bare old links still use the customer-owned API.
export default async function PaymentResultPage({ params, searchParams }: {
  params: Promise<{ checkoutId: string }>
  searchParams: Promise<{ confirmacion?: string | string[] }>
}) {
  const { checkoutId } = await params
  const query = await searchParams
  const returnToken = typeof query.confirmacion === 'string' ? query.confirmacion : undefined
  let initialResult = null
  if (returnToken) {
    try {
      const key = process.env.MERCADOPAGO_ENCRYPTION_KEY ?? ''
      if (checkPaymentReturnToken(checkoutId, returnToken, key)) {
        await enforceRateLimit('receipt', `return-page:${checkoutId}`)
        initialResult = await readPaymentReturnReceipt(checkoutId, returnToken, key)
      }
    } catch { /* The client retries a transient read without blocking the return. */ }
  }
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="inline-flex min-h-11 items-center text-2xl font-black tracking-tight text-lysto-blue" aria-label="Lysto, página principal">Lysto</Link>
        {z.string().uuid().safeParse(checkoutId).success ? <PaymentReturn key={checkoutId} checkoutId={checkoutId} returnToken={returnToken} initialResult={initialResult} /> : (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
            <h1 className="text-2xl font-bold text-slate-950">Revisemos tu pago</h1>
            <p className="my-4 text-slate-600">Este enlace está incompleto. Podés consultar el estado desde tus pagos.</p>
            <ButtonLink href="/app/pagos">Ver mis pagos</ButtonLink>
          </section>
        )}
        <p className="mt-6 text-center text-sm text-slate-500">¿Necesitás ayuda? <Link className="font-semibold text-lysto-blue underline underline-offset-4" href="/contacto">Contactá a Lysto</Link></p>
      </div>
    </main>
  )
}
