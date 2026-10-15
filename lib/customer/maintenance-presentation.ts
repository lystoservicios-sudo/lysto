import { getMaintenanceTask } from '@/lib/customer/maintenance-plan'
import type { MaintenancePlan } from '@/lib/equipment/maintenance-service'

export function maintenanceDate(value: string | null) {
  if (!value) return 'Sin fecha definida'
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value)
  if (!Number.isFinite(date.getTime())) return 'Fecha por revisar'
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires' }).format(date)
}

export function maintenancePresentation(plan: MaintenancePlan) {
  const terminal = plan.status === 'completed' || plan.status === 'cancelled' || plan.recommendation === 'none'
  const continuity = plan.recommendation === 'pending_part_replacement' || plan.recommendation === 'second_visit_recommended'
  const blocked = terminal || plan.superseded || plan.status === 'suppressed_by_case' || plan.contextVerified !== true
  const action = blocked ? null : plan.activeJobId
    ? { href: `/app/trabajos/${plan.activeJobId}`, label: 'Ver servicio en curso' }
    : continuity
      ? plan.sourceJobId && plan.history.some((record) => record.jobId === plan.sourceJobId)
        ? { href: `/app/trabajos/${plan.sourceJobId}`, label: 'Ver servicio de origen' } : null
      : { href: `/app/solicitar/aire-acondicionado?problema=mantenimiento&equipo=${encodeURIComponent(plan.equipmentId)}`, label: 'Pedir mantenimiento' }
  const status = plan.status === 'suppressed_by_case' ? 'En seguimiento'
    : plan.status === 'completed' ? 'Completado'
      : plan.status === 'cancelled' ? 'Cancelado'
        : plan.activeJobId ? 'Servicio en curso'
          : plan.status === 'deferred' ? 'Fecha actualizada' : 'Cuidado recomendado'
  const note = plan.status === 'suppressed_by_case'
    ? 'Hay un caso de garantía o calidad abierto. Primero sigamos la resolución de ese servicio.'
    : plan.contextVerified !== true
      ? 'No pudimos verificar si este equipo tiene un servicio en curso. Actualizá la información antes de pedir otro.'
      : plan.activeJobId ? 'Este equipo ya tiene un servicio en curso. Consultalo antes de pedir otro.'
        : continuity ? 'Este cuidado corresponde al servicio anterior. Consultá su seguimiento para continuar.'
          : plan.status === 'requested'
            ? 'Todavía no hay una visita confirmada. Completá Pedir para elegir la fecha y revisar el precio.' : null
  return { label: getMaintenanceTask(plan.recommendation).label, status, note, action,
    canDefer: !blocked && !continuity && !plan.activeJobId }
}
