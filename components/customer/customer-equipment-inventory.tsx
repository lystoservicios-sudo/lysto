import { CalendarX2, History, Snowflake } from 'lucide-react'

import type { CustomerDataState, CustomerEquipmentViewModel } from '@/features/customer/view-models'
import { MetricStrip } from './metric-strip'
import { EquipmentHistoryCard } from './equipment-history-card'
import { EmptyState, ErrorState, LoadingSkeleton } from './states'

export function CustomerEquipmentInventory({ equipment, state = equipment.length ? 'ready' : 'empty', onRetry, referenceDate = new Date().toISOString().slice(0, 10) }: {
  equipment: readonly CustomerEquipmentViewModel[]
  state?: CustomerDataState
  onRetry?: () => void
  referenceDate?: string
}) {
  if (state === 'loading') return <LoadingSkeleton label="Cargando equipos" rows={6} />
  if (state === 'error') return <ErrorState title="No pudimos cargar tus equipos" description="Reintentá para recuperar las fichas y su historial." onRetry={onRetry} />
  if (state === 'empty') return <EmptyState title="Todavía no tenés equipos registrados" description="Los equipos aparecerán después de un servicio confirmado. No agregamos fichas sin una operación real." />

  const serviceCount = equipment.reduce((total, item) => total + item.serviceCount, 0)
  const overdueCount = equipment.filter((item) => item.nextMaintenanceAt && item.nextMaintenanceAt.slice(0, 10) < referenceDate).length
  const withoutHistory = equipment.filter((item) => item.serviceCount === 0).length
  const metrics = [
    { id: 'equipment', label: 'Equipos registrados', value: equipment.length, description: 'Fichas del hogar', icon: <Snowflake aria-hidden="true" className="h-4 w-4" />, tone: 'brand' as const },
    { id: 'services', label: 'Servicios acumulados', value: serviceCount, description: 'Partes vinculados', icon: <History aria-hidden="true" className="h-4 w-4" />, tone: 'neutral' as const },
    { id: 'overdue', label: 'Mantenimientos vencidos', value: overdueCount, description: overdueCount ? 'Requieren revisión' : 'Todo al día', icon: <CalendarX2 aria-hidden="true" className="h-4 w-4" />, tone: overdueCount ? 'warning' as const : 'neutral' as const },
    { id: 'without-history', label: 'Sin historial', value: withoutHistory, description: 'Datos todavía incompletos', tone: 'neutral' as const }
  ]

  return (
    <div className="space-y-5">
      <MetricStrip items={metrics} />
      <div className="grid gap-4 lg:grid-cols-2">
        {equipment.map((item) => <EquipmentHistoryCard key={item.id} equipment={item} />)}
      </div>
    </div>
  )
}
