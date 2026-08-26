import type { CustomerDataState, CustomerMaintenanceViewModel } from '@/features/customer/view-models'
import { EducationBenefitPanel } from './education-benefit-panel'
import { MaintenanceReminderCard } from './maintenance-reminder-card'
import { EmptyState, ErrorState, LoadingSkeleton } from './states'

export function CustomerMaintenanceCenter({ maintenance, state = maintenance.length ? 'ready' : 'empty', onRetry }: {
  maintenance: readonly CustomerMaintenanceViewModel[]
  state?: CustomerDataState
  onRetry?: () => void
}) {
  if (state === 'loading') return <LoadingSkeleton label="Cargando mantenimientos" rows={6} />
  if (state === 'error') return <ErrorState title="No pudimos cargar las recomendaciones" description="Reintentá para recuperar el plan de mantenimiento." onRetry={onRetry} />
  if (state === 'empty') return <div className="space-y-5"><EducationBenefitPanel /><EmptyState title="No hay recomendaciones de mantenimiento" description="Cuando un cierre técnico indique un próximo cuidado, aparecerá en este espacio." /></div>

  const ordered = [...maintenance].sort((a, b) => {
    const priority = { overdue: 0, soon: 1, planned: 2, none: 3 }
    return priority[a.urgency] - priority[b.urgency]
  })

  return (
    <div className="space-y-5">
      <EducationBenefitPanel />
      <section aria-labelledby="maintenance-list-title">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Próximos cuidados</p>
          <h2 id="maintenance-list-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Recordatorios por equipo</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {ordered.map((reminder) => <MaintenanceReminderCard key={reminder.id} reminder={reminder} />)}
        </div>
      </section>
    </div>
  )
}
