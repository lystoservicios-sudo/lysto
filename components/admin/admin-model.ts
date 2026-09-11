import { jobStatusLabels } from '@/lib/mock/lysto-data'

export const adminModules = [
  { group: 'Operaciones', items: [['Dashboard', 'dashboard'], ['Solicitudes', 'solicitudes'], ['Trabajos', 'trabajos'], ['Matching', 'matching'], ['Zonas', 'zonas']] },
  { group: 'Personas y equipos', items: [['Profesionales', 'profesionales'], ['Invitaciones', 'profesionales/invitaciones'], ['Clientes', 'clientes'], ['Equipos', 'equipos']] },
  { group: 'Calidad', items: [['Calidad', 'calidad'], ['Reclamos', 'reclamos'], ['Garantías', 'garantias'], ['Auditoría', 'auditoria']] },
  { group: 'Negocio', items: [['Pagos', 'pagos'], ['Reportes', 'reportes'], ['Precios', 'precios'], ['Marketplace', 'marketplace']] },
  { group: 'Configuración', items: [['Servicios', 'servicios'], ['Diagnóstico', 'diagnostico'], ['Notificaciones', 'notificaciones'], ['Configuración', 'configuracion']] }
] as const
const labels: Record<string, string> = {
  ...jobStatusLabels, pending_assignment: 'Por asignar', payment_approved: 'Pago aprobado', pending_payment: 'Pendiente de pago',
  approved: 'Aprobado', captured: 'Cobrado', under_review: 'En revisión', suspended: 'Suspendido', connected: 'Conectado',
  pending: 'Pendiente', not_connected: 'Sin conectar', priority: 'Prioritaria', flexible: 'Flexible', normal: 'Regular',
  attention: 'Requiere atención', vip: 'Frecuente', info: 'Información', warning: 'Atención', critical: 'Crítico'
}
export function adminLabel(value: string) { return labels[value] ?? value }
export function normalizeSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() }
export function matchesSearch(query: string, values: string[]) { return normalizeSearch(values.join(' ')).includes(normalizeSearch(query)) }
export function calculateSplit(amount: number, commission: number) {
  const fee = Math.round(Math.max(0, amount) * Math.min(100, Math.max(0, commission)) / 100)
  return { fee, professional: Math.max(0, amount) - fee }
}
export const zones = ['CABA Norte', 'CABA Centro', 'CABA Sur', 'AMBA Norte', 'AMBA Oeste', 'AMBA Sur']
