import { notFound } from 'next/navigation'
import { z } from 'zod'
import { CustomerQuoteDetail } from '@/components/customer/customer-quote-detail'
import { SavedQuotes } from '@/components/pricing/saved-quotes'
import { requirePageSession } from '@/lib/auth/session'
import { MorePage } from '@/components/customer/more/more-ui'
import styles from '@/components/customer/customer-secondary.module.css'

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
  return <MorePage title="Mis presupuestos" description="Revisá el alcance y los importes antes de solicitar un profesional. Aceptar un presupuesto no realiza un cobro." backHref="/app/trabajos" backLabel="Volver a Servicios">
    <div className={styles.quotes}><SavedQuotes heading="Presupuestos disponibles" /></div>
  </MorePage>
}
