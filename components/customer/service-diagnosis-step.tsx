import {
  AirVent, CircuitBoard, Droplets, Fan, House, Info, Plug, Power,
  Ruler, Settings, ShieldCheck, Snowflake, Sun, Thermometer, Volume2, Wrench,
  type LucideIcon
} from 'lucide-react'

import type { DiagnosisReport } from '@/lib/diagnosis/rules'
import type { ServiceIssueSlug } from '@/lib/domain/types'

export const serviceIssueVisuals: Record<ServiceIssueSlug, { icon: LucideIcon; title: string }> = {
  no_enfria: { icon: Snowflake, title: 'El aire no enfría' },
  pierde_agua: { icon: Droplets, title: 'Gotea o acumula agua' },
  hace_ruido: { icon: Volume2, title: 'Hace vibraciones o ruidos' },
  no_enciende: { icon: Power, title: 'El aire no arranca' },
  no_funciona_calor: { icon: Sun, title: 'El aire no calienta' },
  instalacion: { icon: AirVent, title: 'Instalación' },
  mantenimiento: { icon: ShieldCheck, title: 'Mantenimiento' }
}

const causeVisuals: Record<string, { icon: LucideIcon; title: string }> = {
  low_refrigerant: { icon: Snowflake, title: 'Puede haber poco refrigerante o una pérdida' },
  dirty_filters: { icon: AirVent, title: 'Puede haber suciedad en los filtros' },
  capacitor_or_compressor: { icon: Settings, title: 'La unidad exterior puede necesitar revisión' },
  blocked_drain: { icon: Droplets, title: 'El desagüe puede estar tapado' },
  dirty_evaporator: { icon: Snowflake, title: 'Puede haber suciedad o congelamiento' },
  bad_installation_slope: { icon: Ruler, title: 'Puede haber un problema en la instalación' },
  loose_support: { icon: Wrench, title: 'Puede haber un soporte flojo' },
  fan_motor: { icon: Fan, title: 'El ventilador o el motor pueden necesitar revisión' },
  foreign_object: { icon: AirVent, title: 'Puede haber suciedad o un objeto dentro' },
  power_supply: { icon: Plug, title: 'Puede haber un problema de alimentación eléctrica' },
  control_board: { icon: CircuitBoard, title: 'La electrónica puede necesitar revisión' },
  capacitor_start: { icon: Power, title: 'Puede haber una falla en el arranque' },
  reversing_valve: { icon: Settings, title: 'Puede fallar el cambio entre frío y calor' },
  low_refrigerant_heat: { icon: Snowflake, title: 'Puede haber poco refrigerante' },
  sensor_or_board: { icon: Thermometer, title: 'Puede fallar la lectura de temperatura o el control' }
}

type ReviewItem = { title: string; description: string; icon: LucideIcon }

const plannedReviews: Partial<Record<ServiceIssueSlug, ReviewItem[]>> = {
  instalacion: [
    { title: 'Ubicación y soporte del equipo', description: 'Revisión del espacio y de los soportes necesarios.', icon: House },
    { title: 'Conexión eléctrica', description: 'Verificación de la alimentación del equipo.', icon: Plug },
    { title: 'Recorrido y materiales', description: 'Evaluación del acceso y la distancia de las cañerías.', icon: Ruler },
    { title: 'Salida de agua', description: 'Revisión del recorrido y la pendiente del desagüe.', icon: Droplets }
  ],
  mantenimiento: [
    { title: 'Filtros', description: 'Revisión y limpieza según el estado del equipo.', icon: AirVent },
    { title: 'Unidad interior', description: 'Revisión y limpieza del evaporador.', icon: Fan },
    { title: 'Desagüe', description: 'Revisión de la salida de agua.', icon: Droplets },
    { title: 'Funcionamiento general', description: 'Control de temperatura y rendimiento.', icon: Thermometer }
  ]
}

const iconTones = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800', 'bg-violet-100 text-violet-700']

export function ServiceDiagnosisStep({ diagnosis }: { diagnosis: DiagnosisReport }) {
  const { icon: IssueIcon, title } = serviceIssueVisuals[diagnosis.issue]
  const plannedItems = plannedReviews[diagnosis.issue]
  const items: ReviewItem[] = plannedItems ?? diagnosis.causes.map(cause => ({
    title: causeVisuals[cause.code]?.title ?? cause.label,
    icon: causeVisuals[cause.code]?.icon ?? Wrench,
    description: cause.customerHint
  }))

  return (
    <section className="space-y-6" aria-label={`Orientación: ${title}`}>
      <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 sm:h-16 sm:w-16">
          <IssueIcon aria-hidden="true" className="h-8 w-8" />
        </span>
        <h2 className="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
      </div>

      <div>
        <h3 className="text-xl font-black tracking-tight text-slate-950">{plannedItems ? 'Qué vamos a revisar' : 'Qué puede estar pasando'}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{plannedItems ? 'Estos son los puntos que el profesional evaluará durante la visita.' : 'Estas son posibles causas. No necesitás elegir ni saber cuál es.'}</p>
      </div>

      <ul aria-label={plannedItems ? 'Revisión del servicio' : 'Posibles causas'} className="grid gap-3">
        {items.map(({ title: itemTitle, description, icon: Icon }, index) => (
          <li key={itemTitle} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 sm:gap-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconTones[index % iconTones.length]}`}>
              <Icon aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h4 className="font-bold leading-6 text-slate-950">{itemTitle}</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <p>{plannedItems ? 'El profesional confirmará el alcance y los materiales necesarios antes de realizar el trabajo.' : 'El técnico confirmará qué está pasando antes de indicarte la solución.'}</p>
      </div>
    </section>
  )
}
