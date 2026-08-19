import type { ServiceIssueSlug, TimeSince } from '../domain/types.ts'

export type DiagnosisCause = {
  code: string
  label: string
  score: number
  customerHint: string
  technicianChecklist: string[]
}

export type DiagnosisInput = {
  issue: ServiceIssueSlug
  timeSince: TimeSince
  hasPhoto?: boolean
  hasVideo?: boolean
}

export type DiagnosisReport = {
  issue: ServiceIssueSlug
  level: 'low' | 'medium' | 'high'
  topCause: DiagnosisCause
  causes: DiagnosisCause[]
  customerSummary: string
  technicianSummary: string
  disclaimer: string
}

const baseCauses: Record<ServiceIssueSlug, DiagnosisCause[]> = {
  no_enfria: [
    { code: 'low_refrigerant', label: 'Carga de gas baja o fuga', score: 0.78, customerHint: 'El equipo podría requerir revisión de presión, fuga o carga de refrigerante.', technicianChecklist: ['Medir presión', 'Buscar fugas', 'Revisar unidad exterior', 'Verificar consumo eléctrico'] },
    { code: 'dirty_filters', label: 'Filtros o serpentina sucia', score: 0.66, customerHint: 'La falta de mantenimiento puede reducir el rendimiento.', technicianChecklist: ['Revisar filtros', 'Revisar serpentina', 'Medir salto térmico'] },
    { code: 'capacitor_or_compressor', label: 'Capacitor, compresor o unidad exterior', score: 0.48, customerHint: 'Puede existir una falla eléctrica o mecánica.', technicianChecklist: ['Medir capacitor', 'Verificar compresor', 'Medir amperaje'] }
  ],
  pierde_agua: [
    { code: 'blocked_drain', label: 'Drenaje obstruido', score: 0.84, customerHint: 'La manguera o bandeja de drenaje podría estar obstruida.', technicianChecklist: ['Revisar bandeja', 'Destapar drenaje', 'Verificar pendiente'] },
    { code: 'dirty_evaporator', label: 'Evaporador sucio o congelamiento', score: 0.63, customerHint: 'La suciedad puede generar condensación excesiva.', technicianChecklist: ['Revisar evaporador', 'Verificar congelamiento', 'Limpiar filtros'] },
    { code: 'bad_installation_slope', label: 'Pendiente o instalación incorrecta', score: 0.52, customerHint: 'Puede haber un problema de pendiente en el desagüe.', technicianChecklist: ['Revisar nivel', 'Revisar cañería', 'Corregir pendiente'] }
  ],
  hace_ruido: [
    { code: 'loose_support', label: 'Soporte flojo o vibración', score: 0.72, customerHint: 'Puede haber vibraciones por soportes o carcasa.', technicianChecklist: ['Revisar soportes', 'Ajustar carcasa', 'Revisar unidad exterior'] },
    { code: 'fan_motor', label: 'Turbina, buje o motor', score: 0.61, customerHint: 'El ruido puede venir de la turbina o motor.', technicianChecklist: ['Revisar turbina', 'Revisar bujes', 'Verificar motor'] },
    { code: 'foreign_object', label: 'Objeto extraño o suciedad', score: 0.39, customerHint: 'Puede haber suciedad o un objeto generando ruido.', technicianChecklist: ['Inspección visual', 'Limpieza interna'] }
  ],
  no_enciende: [
    { code: 'power_supply', label: 'Problema eléctrico o alimentación', score: 0.76, customerHint: 'Puede haber un problema de alimentación o protección eléctrica.', technicianChecklist: ['Verificar tensión', 'Revisar térmica', 'Revisar tomacorriente'] },
    { code: 'control_board', label: 'Falla de placa o electrónica', score: 0.59, customerHint: 'Puede existir una falla en la placa electrónica.', technicianChecklist: ['Revisar placa', 'Verificar fusibles', 'Probar control'] },
    { code: 'capacitor_start', label: 'Capacitor o arranque', score: 0.43, customerHint: 'El equipo podría fallar al iniciar.', technicianChecklist: ['Medir capacitor', 'Revisar arranque'] }
  ],
  no_funciona_calor: [
    { code: 'reversing_valve', label: 'Válvula inversora defectuosa', score: 0.74, customerHint: 'El modo calor puede fallar por la válvula inversora.', technicianChecklist: ['Revisar válvula inversora', 'Verificar bobina', 'Medir presión'] },
    { code: 'low_refrigerant_heat', label: 'Carga de gas baja', score: 0.69, customerHint: 'La baja carga de refrigerante afecta frío y calor.', technicianChecklist: ['Medir presión', 'Buscar fuga', 'Verificar refrigerante'] },
    { code: 'sensor_or_board', label: 'Sensor o placa electrónica', score: 0.46, customerHint: 'Puede existir falla de sensor o control.', technicianChecklist: ['Revisar sensores', 'Revisar placa', 'Probar modos'] }
  ],
  instalacion: [
    { code: 'installation_scope', label: 'Instalación a relevar', score: 0.7, customerHint: 'Se necesita relevar el lugar, distancia, acceso y materiales.', technicianChecklist: ['Medir distancia de cañería', 'Verificar soporte', 'Evaluar desagüe', 'Revisar alimentación eléctrica'] }
  ],
  mantenimiento: [
    { code: 'preventive_maintenance', label: 'Mantenimiento preventivo', score: 0.78, customerHint: 'Una limpieza y revisión preventiva mejora rendimiento y vida útil.', technicianChecklist: ['Limpiar filtros', 'Limpiar evaporador', 'Revisar drenaje', 'Medir salto térmico'] }
  ]
}

function timeModifier(timeSince: TimeSince): number {
  if (timeSince === 'today') return -0.04
  if (timeSince === 'days') return 0.03
  if (timeSince === 'weeks') return 0.07
  return 0.02
}

function toLevel(score: number): DiagnosisReport['level'] {
  if (score >= 0.72) return 'high'
  if (score >= 0.5) return 'medium'
  return 'low'
}

export function generateDiagnosis(input: DiagnosisInput): DiagnosisReport {
  const causes = (baseCauses[input.issue] ?? [])
    .map((cause) => ({ ...cause, score: Math.max(0.05, Math.min(0.95, Number((cause.score + timeModifier(input.timeSince)).toFixed(2)))) }))
    .sort((a, b) => b.score - a.score)

  const [topCause] = causes
  if (!topCause) throw new Error(`No diagnosis rules configured for issue ${input.issue}`)

  const level = toLevel(topCause.score)
  const mediaContext = input.hasPhoto || input.hasVideo
    ? 'El cliente adjuntó material visual para revisar antes de la visita.'
    : 'El cliente no adjuntó material visual.'

  return {
    issue: input.issue,
    level,
    topCause,
    causes,
    customerSummary: `Posible causa: ${topCause.label}. ${topCause.customerHint}`,
    technicianSummary: `${mediaContext} Revisar principalmente: ${topCause.technicianChecklist.join(', ')}. Diagnóstico preliminar con coincidencia ${level}.`,
    disclaimer: 'Este diagnóstico es preliminar. El técnico lo confirmará en el domicilio.'
  }
}
