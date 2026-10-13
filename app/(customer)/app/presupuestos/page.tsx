import { notFound } from 'next/navigation'
import { z } from 'zod'
import { CustomerQuoteDetail } from '@/components/customer/customer-quote-detail'
import { SavedQuotes } from '@/components/pricing/saved-quotes'
import { requirePageSession } from '@/lib/auth/session'

export default async function Page({ searchParams }: {
  searchParams?: Promise<{ presupuesto?: string | string[] }>
}) {
  await requirePageSession('customer')
  const parameters = await searchParams
  if (parameters?.presupuesto !== undefined) {
    const parsed = z.string().uuid().safeParse(parameters.presupuesto)
    if (!parsed.success) notFound()
    return <CustomerQuoteDetail quoteId={parsed.data} />
  }
  return <div className="space-y-5"><h1 className="text-3xl font-black">Mis presupuestos</h1><p className="text-slate-600">Revisá el alcance y los importes antes de solicitar un profesional. La aceptación no implica un cobro.</p><SavedQuotes /></div>
}
