import type { MaintenanceOption, ServiceIssueSlug } from './types.ts'

export const AIR_CONDITIONING_CATEGORY = {
  slug: 'aire_acondicionado',
  name: 'Aire acondicionado'
} as const

export const AIR_CONDITIONING_ISSUES: Array<{
  slug: ServiceIssueSlug
  title: string
  emoji: string
  description: string
}> = [
  { slug: 'no_enfria', title: 'No enfría', emoji: '🧊', description: 'El equipo funciona, pero no enfría como antes.' },
  { slug: 'pierde_agua', title: 'Pierde agua', emoji: '💧', description: 'Gotea o acumula agua dentro del ambiente.' },
  { slug: 'hace_ruido', title: 'Hace ruido', emoji: '🔊', description: 'Hace vibraciones, golpes o sonidos anormales.' },
  { slug: 'no_enciende', title: 'No enciende', emoji: '⚡', description: 'No prende o se apaga inmediatamente.' },
  { slug: 'no_funciona_calor', title: 'No funciona calor', emoji: '🔥', description: 'No calienta o no invierte correctamente el ciclo.' },
  { slug: 'instalacion', title: 'Instalación', emoji: '🛠️', description: 'Instalación nueva o reinstalación de equipo.' },
  { slug: 'mantenimiento', title: 'Mantenimiento', emoji: '🧹', description: 'Limpieza, revisión preventiva o puesta a punto.' }
]

export const TIME_WINDOWS = [
  '08:00 – 10:00',
  '10:00 – 12:00',
  '14:00 – 16:00',
  '16:00 – 18:00',
  '18:00 – 20:00'
] as const

export const MAINTENANCE_OPTIONS: Record<MaintenanceOption, string> = {
  none: 'Sin mantenimiento recomendado',
  filters_30_days: 'Limpieza de filtros en 30 días',
  filters_60_days: 'Limpieza de filtros en 60 días',
  filters_90_days: 'Limpieza de filtros en 90 días',
  deep_cleaning_6_months: 'Limpieza profunda en 6 meses',
  deep_cleaning_annual: 'Limpieza profunda anual',
  gas_review_30_days: 'Revisión de gas en 30 días',
  outdoor_unit_review: 'Revisión de unidad exterior',
  electrical_review: 'Revisión eléctrica',
  pending_part_replacement: 'Cambio de repuesto pendiente',
  second_visit_recommended: 'Segunda visita recomendada'
}
