import type { Metadata } from 'next'
import Link from 'next/link'
import { z } from 'zod'
import { PaymentReturn } from '@/components/payments/payment-return'
import { ButtonLink } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Tu pago | Lysto',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
}

// Intentionally outside the customer layout: returning from the provider with
// another account or an expired session must offer recovery, not a generic 404.
// All payment data remains behind the authenticated, customer-owned result API.
export default async function PaymentResultPage({ params }: {
  params: Promise<{ checkoutId: string }>
}) {
  const { checkoutId } = await params
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="inline-flex min-h-11 items-center text-2xl font-black tracking-tight text-lysto-blue" aria-label="Lysto, página principal">Lysto</Link>
        {z.string().uuid().safeParse(checkoutId).success ? <PaymentReturn checkoutId={checkoutId} /> : (
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
