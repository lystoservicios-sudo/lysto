'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { StatusTimeline } from '@/components/status/status-timeline'
import { SelectableCard } from '@/components/wizard/selectable-card'
import { ProgressStepper } from '@/components/wizard/progress-stepper'
import { AIR_CONDITIONING_ISSUES, TIME_WINDOWS } from '@/lib/domain/constants'
import type { PropertyType, ServiceIssueSlug, TimeSince, UrgencyLevel } from '@/lib/domain/types'
import { generateDiagnosis } from '@/lib/diagnosis/rules'
import { calculatePriceOptions } from '@/lib/pricing/calculate-price'
import { validateRequestStep } from '@/lib/service-request/validation'

const steps = ['Problema', 'Detalles', 'Diagnóstico', 'Dirección', 'Horario', 'Precio', 'Pago', 'Matching', 'Técnico', 'Seguimiento']
const timeSinceOptions: Array<{ value: TimeSince; label: string; description: string }> = [
  { value: 'today', label: 'Hoy', description: 'Empezó hace pocas horas.' },
  { value: 'days', label: 'Hace días', description: 'Viene pasando esta semana.' },
  { value: 'weeks', label: 'Hace semanas', description: 'El problema se repite.' },
  { value: 'months', label: 'Hace meses', description: 'Ya es un problema antiguo.' }
]

export function AirConditioningWizard() {
  const [step, setStep] = useState(0)
  const [issue, setIssue] = useState<ServiceIssueSlug>('no_enfria')
  const [timeSince, setTimeSince] = useState<TimeSince>('days')
  const [address, setAddress] = useState({ street: 'Av. Corrientes', number: '1240', floor: '7', apartment: 'B', city: 'CABA', province: 'Buenos Aires', propertyType: 'apartment' as PropertyType })
  const [access, setAccess] = useState({ hasElevator: true, hasParking: false, difficultAccess: false, outdoorUnitAtHeight: false })
  const [selectedDay, setSelectedDay] = useState('Mañana')
  const [window, setWindow] = useState<string>(TIME_WINDOWS[1])
  const [option, setOption] = useState<UrgencyLevel>('priority')

  const diagnosis = useMemo(() => generateDiagnosis({ issue, timeSince }), [issue, timeSince])
  const prices = useMemo(() => calculatePriceOptions({ issue, zone: 'caba', propertyType: address.propertyType, access }), [issue, address.propertyType, access])
  const selectedPrice = option === 'priority' ? prices.priority : prices.flexible
  const errors = useMemo(() => validateRequestStep({ issue, timeSince, address: { ...address, access }, preferredDate: selectedDay, preferredTimeWindow: window, selectedOption: option }, step === 0 ? 'issue' : step === 1 ? 'details' : step === 3 ? 'address' : step === 4 ? 'schedule' : step === 5 ? 'price' : 'issue'), [issue, timeSince, address, access, selectedDay, window, option, step])

  return (
    <Card className="mx-auto max-w-3xl p-4 sm:p-6">
      <ProgressStepper steps={steps} current={step} />
      <div className="mt-6 min-h-[520px]">
        {step === 0 ? <StepIssue issue={issue} setIssue={setIssue} /> : null}
        {step === 1 ? <StepDetails timeSince={timeSince} setTimeSince={setTimeSince} /> : null}
        {step === 2 ? <StepDiagnosis diagnosis={diagnosis} /> : null}
        {step === 3 ? <StepAddress address={address} setAddress={setAddress} access={access} setAccess={setAccess} /> : null}
        {step === 4 ? <StepSchedule selectedDay={selectedDay} setSelectedDay={setSelectedDay} window={window} setWindow={setWindow} /> : null}
        {step === 5 ? <StepPricing option={option} setOption={setOption} flexible={prices.flexible.total} priority={prices.priority.total} /> : null}
        {step === 6 ? <StepPayment amount={selectedPrice.total} option={option} /> : null}
        {step === 7 ? <StepMatching /> : null}
        {step === 8 ? <StepTechnician /> : null}
        {step === 9 ? <StepTracking amount={selectedPrice.total} /> : null}
      </div>
      {errors.length && [0, 1, 3, 4, 5].includes(step) ? <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{errors[0]}</div> : null}
      <div className="mt-6 flex gap-3 border-t border-slate-200 pt-4">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Atrás</Button>
        <Button className="flex-1" disabled={errors.length > 0 && [0, 1, 3, 4, 5].includes(step)} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>{step === steps.length - 1 ? 'Ver trabajo creado' : 'Continuar'}</Button>
      </div>
    </Card>
  )
}

function StepIssue({ issue, setIssue }: { issue: ServiceIssueSlug; setIssue: (issue: ServiceIssueSlug) => void }) {
  return <div className="space-y-4"><h2 className="text-2xl font-black">¿Qué sucede?</h2><p className="text-sm text-slate-600">Elegí el motivo de tu consulta para generar un diagnóstico preliminar y asignar el técnico adecuado.</p><div className="grid gap-3 sm:grid-cols-2">{AIR_CONDITIONING_ISSUES.map((item) => <SelectableCard key={item.slug} selected={issue === item.slug} icon={item.emoji} title={item.title} description={item.description} onClick={() => setIssue(item.slug)} />)}</div></div>
}

function StepDetails({ timeSince, setTimeSince }: { timeSince: TimeSince; setTimeSince: (value: TimeSince) => void }) {
  return <div className="space-y-5"><h2 className="text-2xl font-black">Contanos un poco más</h2><div className="grid gap-3 sm:grid-cols-2">{timeSinceOptions.map((item) => <SelectableCard key={item.value} selected={timeSince === item.value} title={item.label} description={item.description} onClick={() => setTimeSince(item.value)} />)}</div><div className="grid gap-3 sm:grid-cols-2"><Card className="border-dashed text-center"><p className="text-3xl">📷</p><p className="font-bold">Tomar foto</p><p className="text-xs text-slate-500">Opcional. Hasta 5 fotos del equipo, control remoto o pérdida.</p></Card><Card className="border-dashed text-center"><p className="text-3xl">🎥</p><p className="font-bold">Agregar video</p><p className="text-xs text-slate-500">Opcional. Ideal para ruidos, goteos o fallas intermitentes.</p></Card></div></div>
}

function StepDiagnosis({ diagnosis }: { diagnosis: ReturnType<typeof generateDiagnosis> }) {
  return <div className="space-y-4"><Badge tone="green">Diagnóstico preliminar</Badge><h2 className="text-2xl font-black">{diagnosis.topCause.label}</h2><p className="text-slate-600">{diagnosis.customerSummary}</p><Card className="bg-blue-50"><p className="text-sm font-bold text-blue-900">Nivel de coincidencia: {diagnosis.level === 'high' ? 'Alto' : diagnosis.level === 'medium' ? 'Medio' : 'Bajo'}</p><p className="mt-2 text-sm text-blue-900">{diagnosis.disclaimer}</p></Card><div className="grid gap-2">{diagnosis.causes.map((cause) => <div key={cause.code} className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{cause.label} · score interno {Math.round(cause.score * 100)}%</div>)}</div><Card className="bg-slate-950 text-white"><p className="text-sm font-black">Informe para técnico</p><p className="mt-2 text-sm leading-6 text-slate-200">{diagnosis.technicianSummary}</p></Card></div>
}

function StepAddress({ address, setAddress, access, setAccess }: { address: { street: string; number: string; floor: string; apartment: string; city: string; province: string; propertyType: PropertyType }; setAddress: (value: { street: string; number: string; floor: string; apartment: string; city: string; province: string; propertyType: PropertyType }) => void; access: { hasElevator: boolean; hasParking: boolean; difficultAccess: boolean; outdoorUnitAtHeight: boolean }; setAccess: (value: { hasElevator: boolean; hasParking: boolean; difficultAccess: boolean; outdoorUnitAtHeight: boolean }) => void }) {
  return <div className="space-y-4"><h2 className="text-2xl font-black">¿Dónde está el equipo?</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="Calle"><Input value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} /></Field><Field label="Número"><Input value={address.number} onChange={(event) => setAddress({ ...address, number: event.target.value })} /></Field><Field label="Piso"><Input value={address.floor} onChange={(event) => setAddress({ ...address, floor: event.target.value })} /></Field><Field label="Departamento"><Input value={address.apartment} onChange={(event) => setAddress({ ...address, apartment: event.target.value })} /></Field></div><div className="grid gap-3 sm:grid-cols-2"><SelectableCard selected={address.propertyType === 'apartment'} title="🏢 Departamento" description="Acceso por edificio" onClick={() => setAddress({ ...address, propertyType: 'apartment' })} /><SelectableCard selected={address.propertyType === 'house'} title="🏠 Casa" description="Acceso desde calle" onClick={() => setAddress({ ...address, propertyType: 'house' })} /></div><div className="grid gap-3 sm:grid-cols-2"><Toggle label="Ascensor" checked={access.hasElevator} onClick={() => setAccess({ ...access, hasElevator: !access.hasElevator })} /><Toggle label="Estacionamiento" checked={access.hasParking} onClick={() => setAccess({ ...access, hasParking: !access.hasParking })} /><Toggle label="Acceso complicado" checked={access.difficultAccess} onClick={() => setAccess({ ...access, difficultAccess: !access.difficultAccess })} /><Toggle label="Unidad exterior en altura" checked={access.outdoorUnitAtHeight} onClick={() => setAccess({ ...access, outdoorUnitAtHeight: !access.outdoorUnitAtHeight })} /></div></div>
}

function Toggle({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left text-sm font-bold transition ${checked ? 'border-lysto-blue bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700'}`}>{checked ? '✓ ' : ''}{label}</button>
}

function StepSchedule({ selectedDay, setSelectedDay, window, setWindow }: { selectedDay: string; setSelectedDay: (value: string) => void; window: string; setWindow: (value: string) => void }) {
  return <div className="space-y-4"><h2 className="text-2xl font-black">Elegí el horario</h2><div className="grid gap-3 sm:grid-cols-3">{['Hoy', 'Mañana', 'Otro día'].map((day) => <SelectableCard key={day} selected={selectedDay === day} title={day === 'Hoy' ? '☀️ Hoy' : day === 'Mañana' ? '🌤️ Mañana' : '📅 Otro día'} onClick={() => setSelectedDay(day)} />)}</div><div className="grid gap-3 sm:grid-cols-2">{TIME_WINDOWS.map((tw) => <SelectableCard key={tw} selected={window === tw} title={tw} onClick={() => setWindow(tw)} />)}</div></div>
}

function StepPricing({ option, setOption, flexible, priority }: { option: UrgencyLevel; setOption: (value: UrgencyLevel) => void; flexible: number; priority: number }) {
  return <div className="space-y-4"><h2 className="text-2xl font-black">Elegí tu presupuesto</h2><div className="grid gap-3 sm:grid-cols-2"><PriceCard title="Flexible" amount={flexible} description="Más económico. Franja horaria más amplia, misma verificación Lysto." selected={option === 'flexible'} onClick={() => setOption('flexible')} /><PriceCard title="Prioridad" amount={priority} description="Mayor prioridad de asignación, mejor SLA y seguimiento preferente." selected={option === 'priority'} recommended onClick={() => setOption('priority')} /></div><Card className="bg-emerald-50 text-emerald-900"><p className="text-sm font-bold">El precio es preliminar para visita/servicio base. Si hay reparación adicional, el técnico carga presupuesto final para aprobación.</p></Card></div>
}

function PriceCard({ title, amount, description, recommended, selected, onClick }: { title: string; amount: number; description: string; recommended?: boolean; selected?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-3xl border bg-white p-5 text-left shadow-card transition ${selected ? 'border-lysto-blue ring-4 ring-blue-100' : 'border-slate-200'}`}><div className="flex items-center justify-between"><h3 className="text-lg font-black">{title}</h3>{recommended ? <Badge tone="green">Recomendado</Badge> : null}</div><p className="mt-4 text-3xl font-black">${amount.toLocaleString('es-AR')}</p><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></button>
}

function StepPayment({ amount, option }: { amount: number; option: UrgencyLevel }) {
  return <div className="space-y-4"><Badge tone="blue">Pago protegido</Badge><h2 className="text-2xl font-black">Reservá el servicio con Mercado Pago</h2><p className="text-slate-600">La integración real crea una preferencia, registra el pago, recibe webhook idempotente y actualiza la solicitud.</p><Card className="space-y-3"><div className="flex justify-between"><span>Plan</span><strong>{option === 'priority' ? 'Prioridad' : 'Flexible'}</strong></div><div className="flex justify-between"><span>Total</span><strong>$ {amount.toLocaleString('es-AR')}</strong></div><div className="flex justify-between"><span>Comisión Lysto estimada</span><strong>$ {Math.round(amount * 0.18).toLocaleString('es-AR')}</strong></div><Button className="w-full">Pagar con Mercado Pago</Button></Card></div>
}

function StepMatching() {
  return <div className="space-y-4"><Badge tone="amber">Matching</Badge><h2 className="text-2xl font-black">Buscando el mejor profesional...</h2><p className="text-slate-600">El sistema calcula candidatos y el admin puede confirmar o reasignar para mantener control de calidad.</p><div className="grid gap-3 sm:grid-cols-2"><Card>Matrícula verificada</Card><Card>Cercanía por zona</Card><Card>Experiencia y score</Card><Card>Disponibilidad real</Card></div></div>
}

function StepTechnician() {
  return <div className="space-y-4"><Badge tone="green">Técnico confirmado</Badge><Card className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-3xl bg-blue-100 text-2xl">MG</div><div><h2 className="text-2xl font-black">Martín Gómez</h2><p className="text-sm text-slate-600">Técnico verificado · Aire acondicionado split e inverter · Rating 4.9</p></div></Card><div className="grid gap-3 sm:grid-cols-2"><Card>Sale hacia tu domicilio dentro de la franja elegida.</Card><Card>Vas a recibir avisos cuando esté en camino y cuando llegue.</Card></div></div>
}

function StepTracking({ amount }: { amount: number }) {
  return <div className="space-y-5"><Badge tone="green">Trabajo creado</Badge><h2 className="text-2xl font-black">Ya podés seguir el servicio</h2><StatusTimeline current={1} steps={['Pago aprobado', 'Profesional asignado', 'En camino', 'Llegó', 'Trabajo terminado']} /><Card className="space-y-2"><p className="text-sm font-bold text-slate-500">Resumen</p><p className="text-2xl font-black">JOB-5009 · $ {amount.toLocaleString('es-AR')}</p><p className="text-sm leading-6 text-slate-600">Desde el panel vas a poder ver estados, comprobante, QR, historial del equipo y review final.</p></Card></div>
}
