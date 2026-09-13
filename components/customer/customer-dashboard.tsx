import { AirVent, CreditCard, MapPin, ShieldCheck } from 'lucide-react'

import { ActiveServiceCard } from './active-service-card'
import { EquipmentHistoryCard } from './equipment-history-card'
import { GreetingHero } from './greeting-hero'
import { MetricStrip } from './metric-strip'
import { QuickActionGrid } from './quick-action-grid'
import { ChatSupportBanner, SupportBanner } from './support-banner'
import { EmptyState, ErrorState, LoadingSkeleton } from './states'
import { ButtonLink } from '@/components/ui/button'
import type { CustomerDataState } from '@/features/customer/view-models'
import type { CustomerDashboardViewModel } from '@/features/customer/dashboard-view-model'

export function CustomerDashboard({
  model,
  state = 'ready',
  onRetry
}: {
  model: CustomerDashboardViewModel
  state?: CustomerDataState
  onRetry?: () => void
}) {
  if (state === 'loading') return <LoadingSkeleton label="Cargando panel del cliente" rows={8} />
  if (state === 'error')
    return (
      <ErrorState
        title="No pudimos cargar tu panel"
        description="Intentá nuevamente en unos minutos."
        onRetry={onRetry}
      />
    )

  return (
    <div className="space-y-7">
      <GreetingHero customerName={model.customerName} />

      {model.isNewCustomer ? (
        <EmptyState
          title="Tu hogar todavía no tiene actividad"
          description="Cuando solicites tu primer servicio, vas a poder seguir la visita y conservar el historial técnico desde acá."
          action={
            <ButtonLink href="/app/solicitar/aire-acondicionado">
              Solicitar mi primer servicio
            </ButtonLink>
          }
        />
      ) : (
        <>
          <MetricStrip items={model.metrics} />
          <section aria-labelledby="active-service-title">
            <h2 id="active-service-title" className="sr-only">
              Servicio activo
            </h2>
            {model.activeJob ? (
              <ActiveServiceCard job={model.activeJob} />
            ) : (
              <EmptyState
                compact
                title="No tenés servicios activos"
                description="Tus trabajos finalizados siguen disponibles en el historial."
                action={
                  <ButtonLink href="/app/trabajos" variant="secondary">
                    Ver historial
                  </ButtonLink>
                }
              />
            )}
          </section>
          <section aria-labelledby="equipment-title" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Historial del hogar
                </p>
                <h2 id="equipment-title" className="mt-1 text-2xl font-black text-slate-950">
                  Tus equipos
                </h2>
              </div>
              <ButtonLink href="/app/equipos" variant="ghost">
                Ver todos
              </ButtonLink>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {model.featuredEquipment.map((item) => (
                <EquipmentHistoryCard key={item.id} equipment={item} compact />
              ))}
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="quick-actions-title" className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Atajos útiles</p>
          <h2 id="quick-actions-title" className="mt-1 text-2xl font-black text-slate-950">
            Gestioná tu hogar
          </h2>
        </div>
        <QuickActionGrid
          actions={[
            {
              id: 'equipment',
              title: 'Equipos',
              description: 'Fichas e historial técnico',
              href: '/app/equipos',
              icon: <AirVent aria-hidden="true" className="h-5 w-5" />
            },
            {
              id: 'addresses',
              title: 'Direcciones',
              description: 'Accesos para cada visita',
              href: '/app/direcciones',
              icon: <MapPin aria-hidden="true" className="h-5 w-5" />
            },
            {
              id: 'warranties',
              title: 'Garantías',
              description: 'Coberturas y calidad',
              href: '/app/garantias',
              icon: <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            },
            {
              id: 'payments',
              title: 'Pagos',
              description: 'Movimientos y comprobantes',
              href: '/app/pagos',
              icon: <CreditCard aria-hidden="true" className="h-5 w-5" />
            }
          ]}
        />
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <SupportBanner />
        <ChatSupportBanner />
      </div>
    </div>
  )
}
