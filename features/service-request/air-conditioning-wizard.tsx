'use client'

import { Building2, CalendarDays, Check, House, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { MediaUploader, type SavedPhoto } from '@/components/customer/media-uploader'
import {
  ServiceDiagnosisStep,
  serviceIssueVisuals
} from '@/components/customer/service-diagnosis-step'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { ProgressStepper } from '@/components/wizard/progress-stepper'
import { AIR_CONDITIONING_ISSUES, TIME_WINDOWS } from '@/lib/domain/constants'
import type {
  AddressAccessDetails,
  PropertyType,
  ServiceIssueSlug,
  TimeSince,
  UrgencyLevel
} from '@/lib/domain/types'
import { generateDiagnosis } from '@/lib/diagnosis/rules'
import type { PriceBreakdown } from '@/lib/pricing/calculate-price'
import {
  calculateServiceQuote,
  defaultQuotePolicy,
  quotePolicySchema,
  type ServiceQuote
} from '@/lib/pricing/service-quote'
import { QuoteBreakdown } from '@/components/pricing/quote-breakdown'
import { validateRequestStep } from '@/lib/service-request/validation'
import { cn } from '@/lib/utils/cn'
import { SavedAddressPicker } from '@/components/customer/saved-address-picker'
import type { CustomerAssetAddress } from '@/lib/customer-assets/contracts'
import type { AssetPage } from '@/lib/customer-assets/client'

const steps = ['Problema', 'Detalles', 'Diagnóstico', 'Dirección', 'Horario', 'Presupuesto', 'Pago']

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
  if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key))
    return

  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  )
  const current =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('[role="radio"]')
      : null
  const currentIndex = current ? radios.indexOf(current) : -1
  if (!radios.length || currentIndex < 0) return

  event.preventDefault()
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? radios.length - 1
        : ['ArrowDown', 'ArrowRight'].includes(event.key)
          ? (currentIndex + 1) % radios.length
          : (currentIndex - 1 + radios.length) % radios.length
  radios[nextIndex]?.focus()
  radios[nextIndex]?.click()
}

export function AirConditioningWizard({
  savedAddresses = { items: [], total: 0, nextCursor: null }
}: {
  savedAddresses?: AssetPage<CustomerAssetAddress>
}) {
  const initialSavedAddress = savedAddresses.items.find(item => item.isDefault && !item.archivedAt)
    ?? savedAddresses.items.find(item => !item.archivedAt)
  const [step, setStep] = useState(0)
  const stepStart = useRef<HTMLDivElement>(null)
  const previousStep = useRef(step)
  useEffect(() => {
    if (previousStep.current === step) return
    previousStep.current = step
    stepStart.current?.focus({ preventScroll: true })
    stepStart.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [step])
  const [issue, setIssue] = useState<ServiceIssueSlug | undefined>()
  const isPlannedService = issue === 'instalacion' || issue === 'mantenimiento'
  const [timeSince, setTimeSince] = useState<TimeSince | undefined>()
  const [files, setFiles] = useState<File[]>([])
  const [savedPhotos, setSavedPhotos] = useState<SavedPhoto[]>([])
  const [uploadBusy, setUploadBusy] = useState(false)
  const [address, setAddress] = useState<AddressDraft>({
    street: initialSavedAddress?.street ?? '',
    number: initialSavedAddress?.number ?? '',
    floor: initialSavedAddress?.floor ?? '',
    apartment: initialSavedAddress?.apartment ?? '',
    city: initialSavedAddress?.city ?? '',
    province: initialSavedAddress?.province ?? '',
    propertyType: initialSavedAddress?.propertyType ?? 'apartment'
  })
  const [access, setAccess] = useState<AddressAccessDetails>({
    hasElevator: false,
    hasParking: false,
    difficultAccess: false,
    outdoorUnitAtHeight: false,
    ...initialSavedAddress?.access
  })
  const [selectedDay, setSelectedDay] = useState('Mañana')
  const [timeWindow, setTimeWindow] = useState<string>(TIME_WINDOWS[1])
  const [option, setOption] = useState<UrgencyLevel>('priority')
  const [capacity, setCapacity] = useState<number | undefined>()
  const [technology, setTechnology] = useState<'conventional' | 'inverter' | 'unknown'>('unknown')
  const [customDate, setCustomDate] = useState('')
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteNotice, setQuoteNotice] = useState('')
  const [serverQuote, setServerQuote] = useState<{ key: string; quote: ServiceQuote } | null>(null)
  const [policy, setPolicy] = useState(defaultQuotePolicy)
  useEffect(() => {
    let active = true
    fetch('/api/pricing/policy')
      .then(async (response) => {
        if (!response.ok) return
        const body = await response.json()
        const parsed = quotePolicySchema.safeParse(body.policy)
        if (active && parsed.success) setPolicy(parsed.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const diagnosis = useMemo(
    () =>
      issue && timeSince
        ? generateDiagnosis({
            issue,
            timeSince,
            hasPhoto: files.some((file) => file.type.startsWith('image/')),
            hasVideo: files.some((file) => file.type.startsWith('video/'))
          })
        : null,
    [files, issue, timeSince]
  )
  const prices = useMemo(() => {
    const data = {
      issue: issue ?? 'no_enfria',
      timeSince: timeSince ?? 'days',
      propertyType: address.propertyType,
      access,
      equipment: { capacity, technology }
    }
    return {
      flexible: calculateServiceQuote({ ...data, urgency: 'flexible' }, policy),
      priority: calculateServiceQuote({ ...data, urgency: 'priority' }, policy)
    }
  }, [access, address.propertyType, issue, timeSince, capacity, technology, policy])
  const quoteKey = JSON.stringify({
    issue,
    timeSince,
    address,
    access,
    capacity,
    technology,
    selectedDay,
    customDate,
    timeWindow,
    option
  })
  const selectedPrice =
    serverQuote?.key === quoteKey
      ? serverQuote.quote
      : option === 'priority'
        ? prices.priority
        : prices.flexible
  async function saveQuote() {
    if (quoteBusy || uploadBusy || savedPhotos.length !== files.length) return
    setQuoteBusy(true)
    setQuoteNotice('')
    try {
      const day = new Date(
        Date.now() + (selectedDay === 'Mañana' ? 86400000 : 0)
      ).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      const result = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue,
          timeSince,
          urgency: option,
          propertyType: address.propertyType,
          access,
          equipment: { capacity, technology },
          address: {
            street: address.street,
            number: address.number,
            city: address.city,
            province: address.province,
            floor: address.floor,
            apartment: address.apartment
          },
          preferredDate: selectedDay === 'Otro día' ? customDate : day,
          timeWindow,
          uploadIntentIds: savedPhotos.map((photo) => photo.upload.intentId),
          save: true
        })
      })
      const data = await result.json()
      if (!result.ok) throw new Error(data.error)
      setServerQuote({ key: quoteKey, quote: data.quote })
      setQuoteNotice(
        'Presupuesto guardado. Podés consultar su revisión en Mis presupuestos. No se realizó ningún cobro.'
      )
    } catch (error) {
      setQuoteNotice(error instanceof Error ? error.message : 'No se pudo guardar el presupuesto.')
    } finally {
      setQuoteBusy(false)
    }
  }

  const validationKey =
    step === 0
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
  const errors = validationKey
    ? validateRequestStep(
        {
          issue,
          timeSince,
          address: { ...address, access },
          preferredDate: selectedDay,
          preferredTimeWindow: timeWindow,
          selectedOption: option
        },
        validationKey
      )
    : []
  if (step === 4 && selectedDay === 'Otro día' && !customDate)
    errors.push('Elegí una fecha para continuar.')
  const isFinalStep = step === steps.length - 1
  function selectIssue(nextIssue: ServiceIssueSlug) {
    const nextIsPlanned = nextIssue === 'instalacion' || nextIssue === 'mantenimiento'
    if (nextIsPlanned !== isPlannedService) setTimeSince(undefined)
    setIssue(nextIssue)
  }
  const brief = {
    issueLabel: issue
      ? AIR_CONDITIONING_ISSUES.find((item) => item.slug === issue)?.title
      : undefined,
    address: `${address.street} ${address.number}`,
    selectedDay: selectedDay === 'Otro día' ? customDate || 'Fecha por elegir' : selectedDay,
    timeWindow,
    amount: step >= 5 ? selectedPrice.total : null,
    fileCount: savedPhotos.length
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <Card className="min-w-0 p-4 shadow-none sm:p-6">
        <div
          ref={stepStart}
          tabIndex={-1}
          role="group"
          aria-label={`Paso ${step + 1} de ${steps.length}: ${steps[step]}`}
          className="scroll-mt-24 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
        >
          <ProgressStepper steps={steps} current={step} />
        </div>
        <div className="mt-6 min-h-80 sm:min-h-[32rem]">
          {step === 0 ? <StepIssue issue={issue} setIssue={selectIssue} /> : null}
          {step === 1 ? (
            <>
              <StepDetails
                planned={isPlannedService}
                timeSince={timeSince}
                setTimeSince={setTimeSince}
                files={files}
                setFiles={setFiles}
                savedPhotos={savedPhotos}
                setSavedPhotos={setSavedPhotos}
                setUploadBusy={setUploadBusy}
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Capacidad del aire (frigorías/h)">
                  <select
                    aria-label="Capacidad del aire (frigorías/h)"
                    className="w-full rounded-xl border border-slate-200 p-3"
                    value={capacity ?? ''}
                    onChange={(e) => setCapacity(Number(e.target.value) || undefined)}
                  >
                    <option value="">No lo sé</option>
                    {[2250, 3000, 4500, 6000, 8000, 9000, 18000].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tecnología del equipo">
                  <select
                    aria-label="Tecnología del equipo"
                    className="w-full rounded-xl border border-slate-200 p-3"
                    value={technology}
                    onChange={(e) => setTechnology(e.target.value as typeof technology)}
                  >
                    <option value="unknown">No lo sé</option>
                    <option value="conventional">Convencional</option>
                    <option value="inverter">Inverter</option>
                  </select>
                </Field>
              </div>
            </>
          ) : null}
          {step === 2 && diagnosis ? <ServiceDiagnosisStep diagnosis={diagnosis} /> : null}
          {step === 3 ? (
            <>
              <SavedAddressPicker
                initialPage={savedAddresses}
                onSelect={(saved) => {
                  setAddress({
                    street: saved.street,
                    number: saved.number,
                    floor: saved.floor ?? '',
                    apartment: saved.apartment ?? '',
                    city: saved.city,
                    province: saved.province,
                    propertyType: saved.propertyType
                  })
                  setAccess(saved.access)
                }}
              />
              <StepAddress
                address={address}
                setAddress={setAddress}
                access={access}
                setAccess={setAccess}
              />
            </>
          ) : null}
          {step === 4 ? (
            <>
              <StepSchedule
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                timeWindow={timeWindow}
                setTimeWindow={setTimeWindow}
              />
              {selectedDay === 'Otro día' ? (
                <div className="mt-4">
                  <Field label="Fecha de visita">
                    <Input
                      aria-label="Fecha de visita"
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
            </>
          ) : null}
          {step === 5 ? (
            <div className="space-y-5">
              <StepPricing
                option={option}
                setOption={setOption}
                flexible={option === 'flexible' ? selectedPrice : prices.flexible}
                priority={option === 'priority' ? selectedPrice : prices.priority}
              />
              <QuoteBreakdown quote={selectedPrice} />
              <Button
                disabled={
                  quoteBusy ||
                  uploadBusy ||
                  savedPhotos.length !== files.length ||
                  (selectedDay === 'Otro día' && !customDate)
                }
                onClick={() => void saveQuote()}
              >
                {quoteBusy
                  ? 'Calculando traslado y guardando…'
                  : 'Calcular traslado y guardar presupuesto'}
              </Button>
              {quoteNotice ? (
                <p role="status" className="text-sm text-blue-800">
                  {quoteNotice}
                </p>
              ) : null}
              <ButtonLink href="/app/presupuestos" variant="secondary">
                Mis presupuestos
              </ButtonLink>
            </div>
          ) : null}
          {step === 6 ? (
            <Card className="space-y-4 p-5">
              <h2 className="text-2xl font-bold">Confirmación y pago</h2>
              <p>
                Primero revisamos el presupuesto y vos aceptás el alcance. Cuando un profesional
                acepte el trabajo, vas a poder pagar con Mercado Pago desde el detalle del servicio.
              </p>
              <p className="text-sm text-slate-600">
                Guardar esta solicitud no genera un cobro. El presupuesto aceptado conserva su
                precio.
              </p>
              <ButtonLink href="/app/presupuestos">Ver mis presupuestos</ButtonLink>
            </Card>
          ) : null}
        </div>

        {step >= 3 ? (
          <details className="mt-6 rounded-2xl border border-slate-200 p-4 xl:hidden">
            <summary className="min-h-11 cursor-pointer content-center font-semibold text-blue-800">
              Ver resumen de la visita
            </summary>
            <div className="pt-4">
              <BriefContents {...brief} />
            </div>
          </details>
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-6 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mb-0 sm:px-0 sm:pb-0">
          {errors.length ? (
            <p role="status" className="mb-3 text-sm leading-5 text-slate-600">
              {step === 0
                ? 'Elegí una opción para continuar.'
                : step === 1 && isPlannedService
                  ? 'Indicá desde cuándo necesitás el servicio.'
                  : errors[0]}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="lg"
              disabled={uploadBusy || step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              Atrás
            </Button>
            {isFinalStep ? (
              <ButtonLink
                href="/app/solicitudes"
                variant="secondary"
                className="h-auto min-h-12 flex-1 py-2 text-center sm:ml-auto sm:flex-none"
              >
                Volver a mis solicitudes
              </ButtonLink>
            ) : (
              <Button
                size="lg"
                className="flex-1 shadow-none sm:ml-auto sm:min-w-40 sm:flex-none"
                disabled={uploadBusy || errors.length > 0}
                onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
              >
                Continuar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <RequestBrief {...brief} />
    </div>
  )
}

function ChoiceCard({
  selected,
  title,
  description,
  icon: Icon,
  onClick,
  compact = false
}: {
  selected: boolean
  title: string
  description?: string
  icon?: LucideIcon
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:p-4',
        selected
          ? 'border-blue-500 bg-blue-50 text-blue-950'
          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'
      )}
    >
      {Icon ? (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <Icon aria-hidden="true" className="h-6 w-6" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block font-black text-slate-950">{title}</span>
        {description ? (
          <span
            className={cn(
              'text-sm leading-5 text-slate-600',
              compact ? 'sr-only sm:not-sr-only sm:mt-1 sm:block' : 'mt-1 block'
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
      {selected ? <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-700" /> : null}
    </button>
  )
}

function StepIssue({
  issue,
  setIssue
}: {
  issue?: ServiceIssueSlug
  setIssue: (issue: ServiceIssueSlug) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          ¿Qué está pasando con tu aire?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Elegí la opción que mejor describe lo que necesitás.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Problema del equipo"
        onKeyDown={handleRadioGroupKeyDown}
        className="grid gap-3 sm:grid-cols-2"
      >
        {AIR_CONDITIONING_ISSUES.map((item) => (
          <ChoiceCard
            key={item.slug}
            compact
            selected={issue === item.slug}
            icon={serviceIssueVisuals[item.slug].icon}
            title={item.slug === 'instalacion' ? 'Instalación o reinstalación' : item.title}
            description={item.description}
            onClick={() => setIssue(item.slug)}
          />
        ))}
      </div>
    </div>
  )
}

function StepDetails({
  timeSince,
  setTimeSince,
  files,
  setFiles,
  planned,
  savedPhotos,
  setSavedPhotos,
  setUploadBusy
}: {
  planned: boolean
  timeSince?: TimeSince
  setTimeSince: (value: TimeSince) => void
  files: readonly File[]
  setFiles: (files: File[]) => void
  savedPhotos: readonly SavedPhoto[]
  setSavedPhotos: (photos: SavedPhoto[]) => void
  setUploadBusy: (busy: boolean) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Contanos un poco más</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {planned
            ? '¿Desde cuándo necesitás este servicio? Podés agregar fotos del equipo o del lugar para preparar la visita.'
            : '¿Desde cuándo pasa? Las fotos también pueden ayudar a preparar la visita.'}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label={planned ? 'Desde cuándo necesitás el servicio' : 'Antigüedad del problema'}
        onKeyDown={handleRadioGroupKeyDown}
        className="grid gap-3 sm:grid-cols-2"
      >
        {timeSinceOptions.map((item) => (
          <ChoiceCard
            key={item.value}
            selected={timeSince === item.value}
            title={item.label}
            description={planned ? undefined : item.description}
            onClick={() => setTimeSince(item.value)}
          />
        ))}
      </div>
      <MediaUploader
        files={files}
        onFilesChange={setFiles}
        savedPhotos={savedPhotos}
        onSavedPhotosChange={setSavedPhotos}
        onBusyChange={setUploadBusy}
      />
    </div>
  )
}

function StepAddress({
  address,
  setAddress,
  access,
  setAccess
}: {
  address: AddressDraft
  setAddress: (value: AddressDraft) => void
  access: AddressAccessDetails
  setAccess: (value: AddressAccessDetails) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          ¿Dónde está el equipo?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Completá la ubicación y las condiciones que pueden afectar la visita.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Calle">
          <Input
            aria-label="Calle"
            value={address.street}
            onChange={(event) => setAddress({ ...address, street: event.target.value })}
          />
        </Field>
        <Field label="Número">
          <Input
            aria-label="Número"
            value={address.number}
            onChange={(event) => setAddress({ ...address, number: event.target.value })}
          />
        </Field>
        <Field label="Piso">
          <Input
            aria-label="Piso"
            value={address.floor}
            onChange={(event) => setAddress({ ...address, floor: event.target.value })}
          />
        </Field>
        <Field label="Departamento">
          <Input
            aria-label="Departamento"
            value={address.apartment}
            onChange={(event) => setAddress({ ...address, apartment: event.target.value })}
          />
        </Field>
        <Field label="Ciudad">
          <Input
            aria-label="Ciudad"
            value={address.city}
            onChange={(event) => setAddress({ ...address, city: event.target.value })}
          />
        </Field>
        <Field label="Provincia">
          <Input
            aria-label="Provincia"
            value={address.province}
            onChange={(event) => setAddress({ ...address, province: event.target.value })}
          />
        </Field>
      </div>
      <div
        role="radiogroup"
        aria-label="Tipo de propiedad"
        onKeyDown={handleRadioGroupKeyDown}
        className="grid gap-3 sm:grid-cols-2"
      >
        <ChoiceCard
          selected={address.propertyType === 'apartment'}
          title="Departamento"
          description="Acceso mediante espacios comunes"
          icon={Building2}
          onClick={() => setAddress({ ...address, propertyType: 'apartment' })}
        />
        <ChoiceCard
          selected={address.propertyType === 'house'}
          title="Casa"
          description="Acceso directo desde la calle"
          icon={House}
          onClick={() => setAddress({ ...address, propertyType: 'house' })}
        />
        <ChoiceCard
          selected={address.propertyType === 'commercial'}
          title="Local comercial"
          description="Local de atención o trabajo"
          icon={Building2}
          onClick={() => setAddress({ ...address, propertyType: 'commercial' })}
        />
        <ChoiceCard
          selected={address.propertyType === 'office'}
          title="Oficina"
          description="Espacio de oficinas"
          icon={Building2}
          onClick={() => setAddress({ ...address, propertyType: 'office' })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AccessToggle
          label="Hay ascensor"
          checked={Boolean(access.hasElevator)}
          onChange={(checked) => setAccess({ ...access, hasElevator: checked })}
        />
        <AccessToggle
          label="Hay estacionamiento"
          checked={Boolean(access.hasParking)}
          onChange={(checked) => setAccess({ ...access, hasParking: checked })}
        />
        <AccessToggle
          label="El acceso es complicado"
          checked={Boolean(access.difficultAccess)}
          onChange={(checked) => setAccess({ ...access, difficultAccess: checked })}
        />
        <AccessToggle
          label="La unidad exterior está en altura"
          checked={Boolean(access.outdoorUnitAtHeight)}
          onChange={(checked) => setAccess({ ...access, outdoorUnitAtHeight: checked })}
        />
        <AccessToggle
          label="Se requieren escaleras"
          checked={Boolean(access.stairsRequired)}
          onChange={(checked) => setAccess({ ...access, stairsRequired: checked })}
        />
        <AccessToggle
          label="La unidad exterior está en un balcón"
          checked={Boolean(access.outdoorUnitOnBalcony)}
          onChange={(checked) => setAccess({ ...access, outdoorUnitOnBalcony: checked })}
        />
      </div>
    </div>
  )
}

function AccessToggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-bold',
        checked
          ? 'border-blue-300 bg-blue-50 text-blue-950'
          : 'border-slate-200 bg-white text-slate-700'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
      />
      {label}
    </label>
  )
}

function StepSchedule({
  selectedDay,
  setSelectedDay,
  timeWindow,
  setTimeWindow
}: {
  selectedDay: string
  setSelectedDay: (value: string) => void
  timeWindow: string
  setTimeWindow: (value: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          Elegí una franja preferida
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          La disponibilidad real se confirmará antes de asignar un profesional.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Día preferido"
        onKeyDown={handleRadioGroupKeyDown}
        className="grid gap-3 sm:grid-cols-3"
      >
        {['Hoy', 'Mañana', 'Otro día'].map((day) => (
          <ChoiceCard
            key={day}
            selected={selectedDay === day}
            title={day}
            icon={CalendarDays}
            onClick={() => setSelectedDay(day)}
          />
        ))}
      </div>
      <div
        role="radiogroup"
        aria-label="Franja horaria"
        onKeyDown={handleRadioGroupKeyDown}
        className="grid gap-3 sm:grid-cols-2"
      >
        {TIME_WINDOWS.map((window) => (
          <ChoiceCard
            key={window}
            selected={timeWindow === window}
            title={window}
            onClick={() => setTimeWindow(window)}
          />
        ))}
      </div>
    </div>
  )
}

function StepPricing({
  option,
  setOption,
  flexible,
  priority
}: {
  option: UrgencyLevel
  setOption: (value: UrgencyLevel) => void
  flexible: PriceBreakdown
  priority: PriceBreakdown
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          Elegí un presupuesto preliminar
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Esta referencia necesita confirmar el traslado, los materiales y el alcance. Guardala para
          revisión. Una vez aceptado el presupuesto, otra falla se registra como adicional y
          requiere tu aprobación.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Opción de presupuesto"
        onKeyDown={handleRadioGroupKeyDown}
        className="grid gap-3 sm:grid-cols-2"
      >
        <PriceOption
          title="Flexible"
          amount={flexible.total}
          description="Franja más amplia y menor prioridad de asignación."
          selected={option === 'flexible'}
          onClick={() => setOption('flexible')}
        />
        <PriceOption
          title="Prioridad"
          amount={priority.total}
          description="Mayor prioridad para encontrar disponibilidad."
          selected={option === 'priority'}
          recommended
          onClick={() => setOption('priority')}
        />
      </div>
      <IncludedServices />
    </div>
  )
}

function PriceOption({
  title,
  amount,
  description,
  selected,
  recommended,
  onClick
}: {
  title: string
  amount: number
  description: string
  selected: boolean
  recommended?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'rounded-3xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-lg font-black text-slate-950">{title}</span>
        {recommended ? <Badge tone="green">Recomendado</Badge> : null}
      </span>
      <span className="mt-4 block text-3xl font-black tabular-nums text-slate-950">
        $ {amount.toLocaleString('es-AR')}
      </span>
      <span className="mt-2 block text-sm leading-6 text-slate-600">{description}</span>
    </button>
  )
}

function IncludedServices() {
  const items = [
    'Orientación preliminar',
    'Coordinación de la visita',
    'Confirmación del presupuesto adicional antes de reparar'
  ]
  return (
    <Card className="shadow-none">
      <div className="flex items-center gap-2">
        <ShieldCheck aria-hidden="true" className="h-5 w-5 text-violet-700" />
        <h3 className="font-black text-slate-950">Qué incluye este paso</h3>
      </div>
      <ul className="mt-4 grid gap-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  )
}

type RequestBriefProps = {
  issueLabel?: string
  address: string
  selectedDay: string
  timeWindow: string
  amount: number | null
  fileCount: number
}

function RequestBrief(props: RequestBriefProps) {
  return (
    <Card className="sticky top-20 hidden space-y-4 shadow-none xl:block">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
          Parte en preparación
        </p>
        <h2 className="mt-1 text-lg font-black text-slate-950">Resumen de la visita</h2>
      </div>
      <BriefContents {...props} />
    </Card>
  )
}

function BriefContents({
  issueLabel,
  address,
  selectedDay,
  timeWindow,
  amount,
  fileCount
}: RequestBriefProps) {
  return (
    <div className="space-y-4">
      <dl className="space-y-3 text-sm">
        <BriefFact label="Problema" value={issueLabel ?? 'Sin elegir'} />
        <BriefFact label="Dirección" value={address} />
        <BriefFact label="Horario" value={`${selectedDay} · ${timeWindow}`} />
        <BriefFact
          label="Evidencia"
          value={`${fileCount} ${fileCount === 1 ? 'archivo' : 'archivos'}`}
        />
        <BriefFact
          label="Presupuesto"
          value={
            amount === null ? 'Se calcula más adelante' : `$ ${amount.toLocaleString('es-AR')}`
          }
        />
      </dl>
      <p className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        Las fotos verificadas quedan guardadas en un borrador privado. Guardá el presupuesto para
        enviarlo a revisión. No se realiza ningún cobro.
      </p>
    </div>
  )
}

function BriefFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 font-bold leading-5 text-slate-950">{value}</dd>
    </div>
  )
}
