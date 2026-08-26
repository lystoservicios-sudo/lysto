import { ReceiptText } from 'lucide-react'

import type { CustomerDataState, CustomerPaymentViewModel } from '@/features/customer/view-models'
import { ChatSupportBanner } from './chat-support-banner'
import { InfoNotice } from './info-notice'
import { PaymentDeferredPanel } from './payment-deferred-panel'
import { PaymentMovementCard } from './payment-movement-card'
import { PaymentProcessStrip } from './payment-process-strip'
import { PaymentTrustHero } from './payment-trust-hero'
import { EmptyState, ErrorState, LoadingSkeleton } from './states'
import { SupportBanner } from './support-banner'

export function CustomerPaymentsCenter({ movements, integrationState, state = 'ready', onRetry }: {
  movements: readonly CustomerPaymentViewModel[]
  integrationState: 'deferred'
  state?: CustomerDataState
  onRetry?: () => void
}) {
  if (state === 'loading') return <LoadingSkeleton label="Cargando pagos" rows={8} />
  if (state === 'error') return <ErrorState title="No pudimos cargar tus pagos" description="Reintentá para consultar el estado de la integración y tus movimientos confirmados." onRetry={onRetry} />

  return (
    <div className="space-y-6" data-integration-state={integrationState}>
      <PaymentTrustHero />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] xl:items-start">
        <section aria-labelledby="payment-movements-title" className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Historial financiero</p><h2 id="payment-movements-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Movimientos</h2></div>
          {movements.length ? <div className="grid gap-4">{movements.map((movement) => <PaymentMovementCard key={movement.id} movement={movement} />)}</div> : <EmptyState icon={<ReceiptText aria-hidden="true" className="h-5 w-5" />} title="Todavía no hay movimientos" description="No agregamos pagos, devoluciones ni comprobantes de demostración. Los registros aparecerán únicamente después de una confirmación real." />}
        </section>
        <PaymentDeferredPanel action="movements" />
      </div>
      <PaymentProcessStrip />
      <InfoNotice tone="security" title="Sin operaciones simuladas" description="Esta pantalla no crea preferencias, IDs de proveedor, cobros, aprobaciones, comprobantes ni devoluciones. El importe visible en otras rutas sigue siendo informativo." />
      <div className="grid gap-4 lg:grid-cols-2"><SupportBanner /><ChatSupportBanner /></div>
    </div>
  )
}
