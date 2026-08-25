'use client'

import {
  AirVent,
  Building2,
  CalendarDays,
  Check,
  Droplets,
  Flame,
  House,
  Power,
  ShieldCheck,
  Sparkles,
  Volume2,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'

import { MediaUploader } from '@/components/customer/media-uploader'
import { PaymentDeferredPanel } from '@/components/customer/payment-deferred-panel'
import { PreliminaryDiagnosisPanel } from '@/components/customer/preliminary-diagnosis-panel'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { ProgressStepper } from '@/components/wizard/progress-stepper'
import { AIR_CONDITIONING_ISSUES, TIME_WINDOWS } from '@/lib/domain/constants'
import type { AddressAccessDetails, PropertyType, ServiceIssueSlug, TimeSince, UrgencyLevel } from '@/lib/domain/types'
import { generateDiagnosis } from '@/lib/diagnosis/rules'
import { calculatePriceOptions, type PriceBreakdown } from '@/lib/pricing/calculate-price'
import { validateRequestStep } from '@/lib/service-request/validation'
import { cn } from '@/lib/utils/cn'

const steps = ['Problema', 'Detalles', 'Diagnóstico', 'Dirección', 'Horario', 'Presupuesto', 'Pago']

const issueIcons: Record<ServiceIssueSlug, LucideIcon> = {
  no_enfria: AirVent,
  pierde_agua: Droplets,
  hace_ruido: Volume2,
  no_enciende: Power,
  no_funciona_calor: Flame,
  instalacion: Wrench,
  mantenimiento: Sparkles
}

const timeSinceOptions: Array<{ value: TimeSince; label: string; description: string }> = [
  { value: 'today', label: 'Hoy', description: 'Empezó hace pocas horas.' },
  { value: 'days', label: 'Hace días', description: 'Viene pasando esta semana.' },
  { value: 'weeks', label: 'Hace semanas', description: 'El problema se repite.' },
  { value: 'months', label: 'Hace meses', description: 'Ya es un problema antiguo.' }
]

type AddressDraft = {
  street: string
  number: string
  floor: string
  apartment: string
  city: string
  province: string
  propertyType: PropertyType
}

function handleRadioGroupKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return

  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
  const current = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[role="radio"]') : null
  const currentIndex = current ? radios.indexOf(current) : -1
  if (!radios.length || currentIndex < 0) return

  event.preventDefault()
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? radios.length - 1
      : ['ArrowDown', 'ArrowRight'].includes(event.key)
        ? (currentIndex + 1) % radios.length
        : (currentIndex - 1 + radios.length) % radios.length
  radios[nextIndex]?.focus()
  radios[nextIndex]?.click()
}

export function AirConditioningWizard() {
  const [step, setStep] = useState(0)
  const [issue, setIssue] = useState<ServiceIssueSlug | undefined>()
  const [timeSince, setTimeSince] = useState<TimeSince | undefined>()
  const [files, setFiles] = useState<File[]>([])
  const [address, setAddress] = useState<AddressDraft>({
    street: 'Av. Corrientes',
    number: '1240',
    floor: '7',
    apartment: 'B',
    city: 'CABA',
    province: 'Buenos Aires',
    propertyType: 'apartment'
  })
  const [access, setAccess] = useState<AddressAccessDetails>({
    hasElevator: true,
    hasParking: false,
    difficultAccess: false,
    outdoorUnitAtHeight: false
  })
  const [selectedDay, setSelectedDay] = useState('Mañana')
  const [timeWindow, setTimeWindow] = useState<string>(TIME_WINDOWS[1])
  const [option, setOption] = useState<UrgencyLevel>('priority')

  const diagnosis = useMemo(
    () => issue && timeSince ? generateDiagnosis({ issue, timeSince, hasPhoto: files.some((file) => file.type.startsWith('image/')), hasVideo: files.some((file) => file.type.startsWith('video/')) }) : null,
    [files, issue, timeSince]
  )
  const prices = useMemo(() => calculatePriceOptions({
    issue: issue ?? 'no_enfria',
    zone: 'caba',
    propertyType: address.propertyType,
    access
  }), [access, address.propertyType, issue])
  const selectedPrice = option === 'priority' ? prices.priority : prices.flexible

  const validationKey = step === 0
    ? 'issue'
    : step === 1
      ? 'details'
      : step === 3
        ? 'address'
        : step === 4
          ? 'schedule'
          : step === 5
            ? 'price'
            : null
  const errors = validationKey ? validateRequestStep({
    issue,
    timeSince,
    address: { ...address, access },
    preferredDate: selectedDay,
    preferredTimeWindow: timeWindow,
    selectedOption: option
  }, validationKey) : []
  const isFinalStep = step === steps.length - 1

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <Card className="min-w-0 p-4 shadow-none sm:p-6">
        <ProgressStepper steps={steps} current={step} />
        <div className="mt-7 min-h-[32rem]">
          {step === 0 ? <StepIssue issue={issue} setIssue={setIssue} /> : null}
          {step === 1 ? <StepDetails timeSince={timeSince} setTimeSince={setTimeSince} files={files} setFiles={setFiles} /> : null}
          {step === 2 && diagnosis ? <StepDiagnosis diagnosis={diagnosis} /> : null}
          {step === 3 ? <StepAddress address={address} setAddress={setAddress} access={access} setAccess={setAccess} /> : null}
          {step === 4 ? <StepSchedule selectedDay={selectedDay} setSelectedDay={setSelectedDay} timeWindow={timeWindow} setTimeWindow={setTimeWindow} /> : null}
          {step === 5 ? <StepPricing option={option} setOption={setOption} flexible={prices.flexible} priority={prices.priority} /> : null}
          {step === 6 ? <PaymentDeferredPanel amount={selectedPrice.total} planLabel={option === 'priority' ? 'Prioridad' : 'Flexible'} /> : null}
        </div>

        {errors.length ? <p role="alert" className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">{errors[0]}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Atrás</Button>
          {isFinalStep ? (
            <ButtonLink href="/app/solicitudes" variant="secondary" className="sm:ml-auto">Volver a mis solicitudes</ButtonLink>
          ) : (
            <Button className="sm:ml-auto sm:min-w-40" disabled={errors.length > 0} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Continuar</Button>
          )}
        </div>
      </Card>

      <RequestBrief
        issueLabel={issue ? AIR_CONDITIONING_ISSUES.find((item) => item.slug === issue)?.title : undefined}
        address={`${address.street} ${address.number}`}
        selectedDay={selectedDay}
        timeWindow={timeWindow}
        amount={step >= 5 ? selectedPrice.total : null}
        fileCount={files.length}
      />
    </div>
  )
}

function ChoiceCard({ selected, title, description, icon: Icon, onClick }: {
  selected: boolean
  title: string
  description?: string
  icon?: LucideIcon
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-24 w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        selected ? 'border-blue-500 bg-blue-50 text-blue-950' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'
      )}
    >
      {Icon ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-blue-700 ring-1 ring-slate-200"><Icon aria-hidden="true" className="h-5 w-5" /></span> : null}
      <span className="min-w-0">
        <span className="block font-black text-slate-950">{title}</span>
        {description ? <span className="mt-1 block text-sm leading-5 text-slate-600">{description}</span> : null}
      </span>
    </button>
  )
}

function StepIssue({ issue, setIssue }: { issue?: ServiceIssueSlug; setIssue: (issue: ServiceIssueSlug) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Badge tone="blue">Inicio del parte</Badge>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">¿Qué está pasando con el equipo?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Elegí una opción para orientar el diagnóstico y preparar la visita.</p>
      </div>
      <div role="radiogroup" aria-label="Problema del equipo" onKeyDown={handleRadioGroupKeyDown} className="grid gap-3 sm:grid-cols-2">
        {AIR_CONDITIONING_ISSUES.map((item) => (
          <ChoiceCard key={item.slug} selected={issue === item.slug} icon={issueIcons[item.slug]} title={item.title} description={item.description} onClick={() => setIssue(item.slug)} />
        ))}
      </div>
    </div>
  )
}

function StepDetails({ timeSince, setTimeSince, files, setFiles }: {
  timeSince?: TimeSince
  setTimeSince: (value: TimeSince) => void
  files: readonly File[]
  setFiles: (files: File[]) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Contanos un poco más</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">La antigüedad del problema y la evidencia ayudan a preparar herramientas y repuestos.</p>
      </div>
      <div role="radiogroup" aria-label="Antigüedad del problema" onKeyDown={handleRadioGroupKeyDown} className="grid gap-3 sm:grid-cols-2">
        {timeSinceOptions.map((item) => <ChoiceCard key={item.value} selected={timeSince === item.value} title={item.label} description={item.description} onClick={() => setTimeSince(item.value)} />)}
      </div>
      <MediaUploader files={files} onFilesChange={setFiles} />
    </div>
  )
}

function StepDiagnosis({ diagnosis }: { diagnosis: ReturnType<typeof generateDiagnosis> }) {
  return (
    <div className="space-y-5">
      <PreliminaryDiagnosisPanel summary={diagnosis.customerSummary} />
      <div>
        <h3 className="font-black text-slate-950">Posibles causas a revisar</h3>
        <ul className="mt-3 grid gap-2">
          {diagnosis.causes.map((cause, index) => (
            <li key={cause.code} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-blue-700 ring-1 ring-slate-200">{index + 1}</span>
              {cause.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function StepAddress({ address, setAddress, access, setAccess }: {
  address: AddressDraft
  setAddress: (value: AddressDraft) => void
  access: AddressAccessDetails
  setAccess: (value: AddressAccessDetails) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">¿Dónde está el equipo?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Completá la ubicación y las condiciones que pueden afectar la visita.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Calle"><Input aria-label="Calle" value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} /></Field>
        <Field label="Número"><Input aria-label="Número" value={address.number} onChange={(event) => setAddress({ ...address, number: event.target.value })} /></Field>
        <Field label="Piso"><Input aria-label="Piso" value={address.floor} onChange={(event) => setAddress({ ...address, floor: event.target.value })} /></Field>
        <Field label="Departamento"><Input aria-label="Departamento" value={address.apartment} onChange={(event) => setAddress({ ...address, apartment: event.target.value })} /></Field>
        <Field label="Ciudad"><Input aria-label="Ciudad" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></Field>
        <Field label="Provincia"><Input aria-label="Provincia" value={address.province} onChange={(event) => setAddress({ ...address, province: event.target.value })} /></Field>
      </div>
      <div role="radiogroup" aria-label="Tipo de propiedad" onKeyDown={handleRadioGroupKeyDown} className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard selected={address.propertyType === 'apartment'} title="Departamento" description="Acceso mediante espacios comunes" icon={Building2} onClick={() => setAddress({ ...address, propertyType: 'apartment' })} />
        <ChoiceCard selected={address.propertyType === 'house'} title="Casa" description="Acceso directo desde la calle" icon={House} onClick={() => setAddress({ ...address, propertyType: 'house' })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AccessToggle label="Hay ascensor" checked={Boolean(access.hasElevator)} onChange={(checked) => setAccess({ ...access, hasElevator: checked })} />
        <AccessToggle label="Hay estacionamiento" checked={Boolean(access.hasParking)} onChange={(checked) => setAccess({ ...access, hasParking: checked })} />
        <AccessToggle label="El acceso es complicado" checked={Boolean(access.difficultAccess)} onChange={(checked) => setAccess({ ...access, difficultAccess: checked })} />
        <AccessToggle label="La unidad exterior está en altura" checked={Boolean(access.outdoorUnitAtHeight)} onChange={(checked) => setAccess({ ...access, outdoorUnitAtHeight: checked })} />
      </div>
    </div>
  )
}

function AccessToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={cn('flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-bold', checked ? 'border-blue-300 bg-blue-50 text-blue-950' : 'border-slate-200 bg-white text-slate-700')}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
      {label}
    </label>
  )
}

function StepSchedule({ selectedDay, setSelectedDay, timeWindow, setTimeWindow }: {
  selectedDay: string
  setSelectedDay: (value: string) => void
  timeWindow: string
  setTimeWindow: (value: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Elegí una franja preferida</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">La disponibilidad real se confirmará antes de asignar un profesional.</p>
      </div>
      <div role="radiogroup" aria-label="Día preferido" onKeyDown={handleRadioGroupKeyDown} className="grid gap-3 sm:grid-cols-3">
        {['Hoy', 'Mañana', 'Otro día'].map((day) => <ChoiceCard key={day} selected={selectedDay === day} title={day} icon={CalendarDays} onClick={() => setSelectedDay(day)} />)}
      </div>
      <div role="radiogroup" aria-label="Franja horaria" onKeyDown={handleRadioGroupKeyDown} className="grid gap-3 sm:grid-cols-2">
        {TIME_WINDOWS.map((window) => <ChoiceCard key={window} selected={timeWindow === window} title={window} onClick={() => setTimeWindow(window)} />)}
      </div>
    </div>
  )
}

function StepPricing({ option, setOption, flexible, priority }: {
  option: UrgencyLevel
  setOption: (value: UrgencyLevel) => void
  flexible: PriceBreakdown
  priority: PriceBreakdown
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Elegí un presupuesto preliminar</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">El importe puede cambiar únicamente si el profesional detecta un trabajo adicional y vos lo aprobás.</p>
      </div>
      <div role="radiogroup" aria-label="Opción de presupuesto" onKeyDown={handleRadioGroupKeyDown} className="grid gap-3 sm:grid-cols-2">
        <PriceOption title="Flexible" amount={flexible.total} description="Franja más amplia y menor prioridad de asignación." selected={option === 'flexible'} onClick={() => setOption('flexible')} />
        <PriceOption title="Prioridad" amount={priority.total} description="Mayor prioridad para encontrar disponibilidad." selected={option === 'priority'} recommended onClick={() => setOption('priority')} />
      </div>
      <IncludedServices />
    </div>
  )
}

function PriceOption({ title, amount, description, selected, recommended, onClick }: {
  title: string
  amount: number
  description: string
  selected: boolean
  recommended?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={cn('rounded-3xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2', selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300')}>
      <span className="flex items-start justify-between gap-3"><span className="text-lg font-black text-slate-950">{title}</span>{recommended ? <Badge tone="green">Recomendado</Badge> : null}</span>
      <span className="mt-4 block text-3xl font-black tabular-nums text-slate-950">$ {amount.toLocaleString('es-AR')}</span>
      <span className="mt-2 block text-sm leading-6 text-slate-600">{description}</span>
    </button>
  )
}

function IncludedServices() {
  const items = ['Orientación preliminar', 'Coordinación de la visita', 'Confirmación del presupuesto adicional antes de reparar']
  return (
    <Card className="shadow-none">
      <div className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="h-5 w-5 text-violet-700" /><h3 className="font-black text-slate-950">Qué incluye este paso</h3></div>
      <ul className="mt-4 grid gap-2 text-sm text-slate-700">
        {items.map((item) => <li key={item} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />{item}</li>)}
      </ul>
    </Card>
  )
}

function RequestBrief({ issueLabel, address, selectedDay, timeWindow, amount, fileCount }: {
  issueLabel?: string
  address: string
  selectedDay: string
  timeWindow: string
  amount: number | null
  fileCount: number
}) {
  return (
    <Card className="sticky top-20 hidden space-y-4 shadow-none xl:block">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Parte en preparación</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">Resumen de la visita</h2>
      </div>
      <dl className="space-y-3 text-sm">
        <BriefFact label="Problema" value={issueLabel ?? 'Sin elegir'} />
        <BriefFact label="Dirección" value={address} />
        <BriefFact label="Horario" value={`${selectedDay} · ${timeWindow}`} />
        <BriefFact label="Evidencia" value={`${fileCount} ${fileCount === 1 ? 'archivo' : 'archivos'}`} />
        <BriefFact label="Presupuesto" value={amount === null ? 'Se calcula más adelante' : `$ ${amount.toLocaleString('es-AR')}`} />
      </dl>
      <p className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Nada se enviará ni cobrará mientras la persistencia y la pasarela estén pendientes.</p>
    </Card>
  )
}

function BriefFact({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"><dt className="font-medium text-slate-500">{label}</dt><dd className="mt-1 font-bold leading-5 text-slate-950">{value}</dd></div>
}
