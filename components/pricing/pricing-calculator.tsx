'use client'
import { useEffect, useMemo, useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { AIR_CONDITIONING_ISSUES, TIME_WINDOWS } from '@/lib/domain/constants'
import {
  calculateServiceQuote,
  defaultQuotePolicy,
  referenceCatalog,
  scenarioCodes,
  type QuoteInput,
  type QuotePolicy,
  type ServiceQuote,
  type TravelEstimate
} from '@/lib/pricing/service-quote'
import { QuoteBreakdown } from './quote-breakdown'
import { SavedQuotes } from './saved-quotes'
import { ServiceOffers } from './service-offers'

const tomorrow = () =>
  new Date(Date.now() + 86400000).toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires'
  })
const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm'
export function PricingCalculator({
  canFinance = false,
  canOperations = true
}: {
  canFinance?: boolean
  canOperations?: boolean
}) {
  const [input, setInput] = useState<QuoteInput>({
    issue: 'no_enfria',
    timeSince: 'days',
    urgency: 'flexible',
    propertyType: 'apartment',
    access: { hasParking: true },
    equipment: { capacity: 3000, technology: 'conventional' },
    materials: [],
    materialsConfirmed: false
  })
  const [address, setAddress] = useState({
    street: 'Av. Corrientes',
    number: '1240',
    city: 'CABA',
    province: 'Buenos Aires'
  })
  const [date, setDate] = useState(tomorrow)
  const [timeWindow, setTimeWindow] = useState<string>(TIME_WINDOWS[1])
  const [customerId, setCustomerId] = useState('')
  const [policy, setPolicy] = useState<QuotePolicy>(defaultQuotePolicy)
  const [policyRevision, setPolicyRevision] = useState(0)
  const [policyReason, setPolicyReason] = useState('')
  const [manualRouteReason, setManualRouteReason] = useState('')
  const [replaces, setReplaces] = useState<{ id: string; version: number } | null>(null)
  const [revisionReason, setRevisionReason] = useState('')
  const [savedPolicy, setSavedPolicy] = useState(JSON.stringify(defaultQuotePolicy))
  const policyDirty = JSON.stringify(policy) !== savedPolicy
  const [routeConfirmed, setRouteConfirmed] = useState(false)
  const [manual, setManual] = useState(false)
  const [route, setRoute] = useState<TravelEstimate>({
    source: 'manual',
    origin: 'Obelisco, CABA',
    destination: 'Domicilio indicado',
    province: 'CABA',
    outboundKm: 10,
    returnKm: 10,
    outboundMinutes: 30,
    returnMinutes: 30,
    tolls: 0,
    tollsVerified: false,
    measuredAt: new Date().toISOString()
  })
  const [materialPrice, setMaterialPrice] = useState(0)
  const [materialDescription, setMaterialDescription] = useState('Materiales relevados')
  const [materialQuantity, setMaterialQuantity] = useState(1)
  const [otherMaterials, setOtherMaterials] = useState<NonNullable<QuoteInput['materials']>>([])
  const [busy, setBusy] = useState(true)
  const [notice, setNotice] = useState('')
  const [remote, setRemote] = useState<{ key: string; quote: ServiceQuote } | null>(null)
  const [revision, setRevision] = useState(0)
  const materials = useMemo(
    () => [
      ...(materialPrice > 0
        ? [
            {
              description: materialDescription,
              unitPrice: materialPrice,
              quantity: materialQuantity
            }
          ]
        : []),
      ...otherMaterials
    ],
    [materialPrice, materialDescription, materialQuantity, otherMaterials]
  )
  const key = JSON.stringify({
    input,
    address,
    date,
    timeWindow,
    customerId,
    policy,
    manual,
    route,
    materials
  })
  const preview = useMemo(() => {
    try {
      return calculateServiceQuote(
        { ...input, materials, route: manual ? route : undefined },
        policy
      )
    } catch {
      return null
    }
  }, [input, materials, manual, route, policy])
  const quote = remote?.key === key ? remote.quote : preview
  useEffect(() => {
    let active = true
    fetch('/api/pricing/policy')
      .then(async (res) => {
        const data = await res.json()
        if (active && res.ok) {
          setPolicy(data.policy)
          setPolicyRevision(data.revision)
          setSavedPolicy(JSON.stringify(data.policy))
        }
      })
      .catch(() => {
        if (active) setNotice('No se pudo consultar la política vigente.')
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
  }, [])
  const update = <K extends keyof QuoteInput>(name: K, value: QuoteInput[K]) =>
    setInput((previous) => ({ ...previous, [name]: value }))
  async function calculate(save: boolean) {
    if (
      busy ||
      !canOperations ||
      policyDirty ||
      (manual && (!routeConfirmed || manualRouteReason.trim().length < 15)) ||
      (save && replaces && revisionReason.trim().length < 15)
    )
      return
    setBusy(true)
    setNotice('')
    try {
      const { route: priorRoute, ...serviceInput } = input
      void priorRoute
      const result = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...serviceInput,
          materials,
          address,
          preferredDate: date,
          timeWindow,
          ...(save && replaces
            ? { previousQuoteId: replaces.id, expectedVersion: replaces.version, revisionReason }
            : {}),
          ...(manual
            ? {
                manualRouteReason,
                manualRoute: {
                  ...route,
                  measuredAt: new Date().toISOString(),
                  destination: `${address.street} ${address.number}, ${address.city}`
                }
              }
            : {}),
          save,
          ...(customerId ? { customerId } : {})
        })
      })
      const data = await result.json()
      if (!result.ok) throw new Error(data.error)
      if (save) {
        setReplaces(null)
        setRevisionReason('')
      }
      setRemote({ key, quote: data.quote })
      setNotice(
        save
          ? 'Presupuesto guardado. Revisá su estado antes de ofrecerlo.'
          : (data.routingNotice ?? 'Presupuesto calculado por el servidor.')
      )
      setRevision((value) => value + 1)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo calcular.')
    } finally {
      setBusy(false)
    }
  }
  async function savePolicy() {
    if (!canFinance || policyReason.trim().length < 15 || busy) return
    setBusy(true)
    try {
      const result = await fetch('/api/pricing/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy: { ...policy, version: `lysto-${new Date().toISOString()}` },
          expectedRevision: policyRevision,
          reason: policyReason
        })
      })
      const data = await result.json()
      if (!result.ok) throw new Error(data.error)
      setPolicy(data.policy)
      setPolicyRevision(data.revision)
      setSavedPolicy(JSON.stringify(data.policy))
      setPolicyReason('')
      setNotice(
        'Política versionada. Recalculá los presupuestos pendientes antes de ofrecerlos; los aceptados conservan sus importes.'
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <fieldset disabled={busy} className="space-y-6">
      <div>
        <ButtonLink href="/admin/precios" variant="secondary">
          Volver a precios
        </ButtonLink>
        <h1 className="mt-5 text-3xl font-black">Calculadora de servicios</h1>
        <p className="mt-2 text-slate-600">
          Revisá el costo del trabajo, el traslado y la propuesta al técnico antes de ofrecer el
          presupuesto.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="space-y-5">
          <Card className="space-y-4 p-5 shadow-none">
            <h2 className="text-xl font-bold">Trabajo y equipo</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Problema">
                <select
                  className={fieldClass}
                  value={input.issue}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      issue: e.target.value as QuoteInput['issue'],
                      scenario: undefined
                    })
                  }
                >
                  {AIR_CONDITIONING_ISSUES.map((issue) => (
                    <option key={issue.slug} value={issue.slug}>
                      {issue.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Alcance previsto">
                <select
                  className={fieldClass}
                  value={input.scenario ?? scenarioCodes[input.issue][0]}
                  onChange={(e) => update('scenario', e.target.value as QuoteInput['scenario'])}
                >
                  {scenarioCodes[input.issue].map((code) => (
                    <option key={code} value={code}>
                      {referenceCatalog[code].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Capacidad (frigorías/h)">
                <select
                  className={fieldClass}
                  value={input.equipment?.capacity ?? ''}
                  onChange={(e) =>
                    update('equipment', {
                      ...input.equipment,
                      capacity: Number(e.target.value) || undefined
                    })
                  }
                >
                  <option value="">Por confirmar</option>
                  {[2250, 3000, 4500, 6000, 8000, 9000, 18000].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tecnología">
                <select
                  className={fieldClass}
                  value={input.equipment?.technology}
                  onChange={(e) =>
                    update('equipment', {
                      ...input.equipment,
                      technology: e.target.value as 'inverter' | 'conventional' | 'unknown'
                    })
                  }
                >
                  <option value="conventional">Convencional</option>
                  <option value="inverter">Inverter</option>
                  <option value="unknown">Por confirmar</option>
                </select>
              </Field>
              <Field label="Propiedad">
                <select
                  className={fieldClass}
                  value={input.propertyType}
                  onChange={(e) =>
                    update('propertyType', e.target.value as QuoteInput['propertyType'])
                  }
                >
                  <option value="apartment">Departamento</option>
                  <option value="house">Casa</option>
                  <option value="commercial">Local comercial</option>
                  <option value="office">Oficina</option>
                </select>
              </Field>
              <Field label="Prioridad">
                <select
                  className={fieldClass}
                  value={input.urgency}
                  onChange={(e) => update('urgency', e.target.value as QuoteInput['urgency'])}
                >
                  <option value="flexible">Flexible</option>
                  <option value="priority">Prioridad</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['difficultAccess', 'Acceso complicado'],
                  ['outdoorUnitAtHeight', 'Unidad en altura'],
                  ['stairsRequired', 'Acceso por escalera'],
                  ['hasParking', 'Estacionamiento disponible']
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(input.access[name])}
                    onChange={(e) =>
                      update('access', { ...input.access, [name]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </Card>
          <Card className="space-y-4 p-5 shadow-none">
            <h2 className="text-xl font-bold">Domicilio y traslado</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['street', 'Calle'],
                  ['number', 'Altura'],
                  ['city', 'Localidad'],
                  ['province', 'Provincia']
                ] as const
              ).map(([name, label]) => (
                <Field key={name} label={label}>
                  <Input
                    value={address[name]}
                    onChange={(e) => {
                      setAddress({ ...address, [name]: e.target.value })
                      setRouteConfirmed(false)
                    }}
                  />
                </Field>
              ))}
              <Field label="Fecha">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    setRouteConfirmed(false)
                  }}
                />
              </Field>
              <Field label="Franja">
                <select
                  className={fieldClass}
                  value={timeWindow}
                  onChange={(e) => {
                    setTimeWindow(e.target.value)
                    setRouteConfirmed(false)
                  }}
                >
                  {TIME_WINDOWS.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={manual}
                onChange={(e) => {
                  setManual(e.target.checked)
                  setRouteConfirmed(false)
                }}
              />
              Cargar un traslado relevado por operaciones
            </label>
            {manual ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ['outboundKm', 'Kilómetros de ida'],
                    ['returnKm', 'Kilómetros de vuelta'],
                    ['outboundMinutes', 'Minutos de ida'],
                    ['returnMinutes', 'Minutos de vuelta'],
                    ['tolls', 'Peajes totales']
                  ] as const
                ).map(([name, label]) => (
                  <Field key={name} label={label}>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={route[name]}
                      onChange={(e) => {
                        setRoute({ ...route, [name]: Number(e.target.value) })
                        setRouteConfirmed(false)
                      }}
                    />
                  </Field>
                ))}
                <Field label="Jurisdicción verificada">
                  <select
                    className={fieldClass}
                    value={route.province}
                    onChange={(e) =>
                      setRoute({ ...route, province: e.target.value as TravelEstimate['province'] })
                    }
                  >
                    <option>CABA</option>
                    <option>Buenos Aires</option>
                    <option value="other">Fuera de cobertura</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={route.tollsVerified}
                    onChange={(e) => setRoute({ ...route, tollsVerified: e.target.checked })}
                  />
                  Peajes confirmados, incluso si son $0
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={routeConfirmed}
                    onChange={(e) => setRouteConfirmed(e.target.checked)}
                  />
                  Verifiqué este trayecto para el domicilio, fecha y horario indicados.
                </label>
                <Field label="Fundamento del traslado manual">
                  <Input
                    aria-label="Fundamento del traslado manual"
                    value={manualRouteReason}
                    onChange={(event) => setManualRouteReason(event.target.value)}
                    placeholder="Fuente y condiciones relevadas del trayecto"
                  />
                </Field>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Se consultarán rutas de ida y vuelta con Google Maps. Cobertura máxima: 180 minutos
                de ida desde la base de referencia en CABA.
              </p>
            )}
          </Card>
          <Card className="space-y-4 p-5 shadow-none">
            <h2 className="text-xl font-bold">Materiales y repuestos</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Concepto">
                <Input
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                />
              </Field>
              <Field label="Precio unitario">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={materialPrice}
                  onChange={(e) => setMaterialPrice(Number(e.target.value))}
                />
              </Field>
              <Field label="Cantidad">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={materialQuantity}
                  onChange={(e) => setMaterialQuantity(Number(e.target.value))}
                />
              </Field>
            </div>
            {otherMaterials.map((material, index) => (
              <div key={index} className="flex flex-wrap items-center gap-3 text-sm">
                <span>
                  {material.description} · {material.quantity} × ${' '}
                  {material.unitPrice.toLocaleString('es-AR')}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setOtherMaterials((rows) => rows.filter((_, i) => i !== index))}
                >
                  Quitar material
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              disabled={
                materialPrice <= 0 || materialQuantity <= 0 || materialDescription.trim().length < 2
              }
              onClick={() => {
                setOtherMaterials((rows) => [
                  ...rows,
                  {
                    description: materialDescription,
                    unitPrice: materialPrice,
                    quantity: materialQuantity
                  }
                ])
                setMaterialPrice(0)
                setMaterialQuantity(1)
                setMaterialDescription('')
              }}
            >
              Agregar otro material
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={input.materialsConfirmed}
                onChange={(e) => update('materialsConfirmed', e.target.checked)}
              />
              Confirmé los materiales del alcance, o que no se necesitan.
            </label>
          </Card>
          <Card className="space-y-4 p-5 shadow-none">
            {replaces ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Nueva revisión del presupuesto {replaces.id}. El cliente se conserva.
                </p>
                <Field label="Motivo de la nueva revisión">
                  <Input
                    aria-label="Motivo de la nueva revisión"
                    value={revisionReason}
                    onChange={(event) => setRevisionReason(event.target.value)}
                  />
                </Field>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReplaces(null)
                    setRevisionReason('')
                  }}
                >
                  Crear un presupuesto independiente
                </Button>
              </div>
            ) : null}
            <Field label="Identificador del cliente (para guardar)">
              <Input
                aria-label="Identificador del cliente (para guardar)"
                disabled={Boolean(replaces)}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Cliente asociado al presupuesto"
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={
                  busy ||
                  !canOperations ||
                  !quote ||
                  policyDirty ||
                  (manual && (!routeConfirmed || manualRouteReason.trim().length < 15))
                }
                onClick={() => void calculate(false)}
              >
                {busy ? 'Procesando…' : 'Calcular con datos del servidor'}
              </Button>
              <Button
                variant="secondary"
                disabled={
                  busy ||
                  !canOperations ||
                  (replaces !== null && revisionReason.trim().length < 15) ||
                  !customerId ||
                  !quote ||
                  policyDirty ||
                  (manual && (!routeConfirmed || manualRouteReason.trim().length < 15))
                }
                onClick={() => void calculate(true)}
              >
                Guardar presupuesto
              </Button>
            </div>
            {policyDirty ? (
              <p className="text-sm text-amber-900">
                Hay tarifas sin guardar. Guardá la configuración antes de calcular o guardar un
                presupuesto.
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="text-sm text-blue-800">
                {notice}
              </p>
            ) : null}
          </Card>
        </div>
        <aside className="xl:sticky xl:top-20">
          {quote ? (
            <>
              <p className="mb-3 text-xs font-semibold text-slate-500">
                {remote?.key === key
                  ? 'Resultado del servidor'
                  : 'Simulación interna con los valores del formulario'}
              </p>
              <QuoteBreakdown quote={quote} internal />
            </>
          ) : (
            <Card className="p-5">
              <p role="alert">
                El alcance necesita una cotización manual o hay importes inválidos. No se generó un
                precio.
              </p>
            </Card>
          )}
        </aside>
      </div>
      {canFinance ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer font-bold">
            Tarifas y parámetros de la calculadora
          </summary>
          <p className="mt-3 text-sm text-slate-600">
            Valores iniciales de referencia, pendientes de calibración. La provisión de cobro no es
            una tarifa verificada de Mercado Pago.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(
              [
                ['laborIndex', 'Factor de actualización de mano de obra'],
                ['perKm', 'Costo por kilómetro'],
                ['perMinute', 'Costo por minuto'],
                ['minimumTravel', 'Traslado mínimo'],
                ['paymentCostRate', 'Costo estimado Mercado Pago (0,06 = 6%)'],
                ['priorityMultiplier', 'Multiplicador de prioridad'],
                ['difficultAccess', 'Acceso complicado'],
                ['height', 'Trabajo en altura'],
                ['stairs', 'Escaleras'],
                ['noParking', 'Estacionamiento'],
                ['commercial', 'Local comercial'],
                ['office', 'Oficina'],
                ['inverterRate', 'Adicional inverter (0,15 = 15%)']
              ] as const
            ).map(([name, label]) => (
              <Field key={name} label={label}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={policy[name]}
                  onChange={(e) => setPolicy({ ...policy, [name]: Number(e.target.value) })}
                />
              </Field>
            ))}
            <Field label="Comisión Lysto (%)">
              <Input
                type="number"
                min="0"
                max="50"
                step="0.01"
                value={Math.round(policy.platformFeeRate * 10000) / 100}
                onChange={(e) =>
                  setPolicy({ ...policy, platformFeeRate: Number(e.target.value) / 100 })
                }
              />
              <p className="text-xs text-slate-600">
                Sólo para presupuestos nuevos. El costo estimado del técnico debe quedar cubierto.
              </p>
            </Field>
            <Field label="Fuente de las tarifas">
              <Input
                value={policy.source}
                onChange={(e) => setPolicy({ ...policy, source: e.target.value })}
              />
            </Field>
            <Field label="Fecha de la fuente">
              <Input
                type="date"
                value={policy.sourceDate}
                onChange={(e) => setPolicy({ ...policy, sourceDate: e.target.value })}
              />
            </Field>
            <Field label="Tarifas verificadas hasta">
              <Input
                type="date"
                value={policy.approvedUntil ?? ''}
                onChange={(e) => setPolicy({ ...policy, approvedUntil: e.target.value || null })}
              />
            </Field>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(
              [
                'maintenance',
                'deep_maintenance',
                'leak',
                'board',
                'capacitor',
                'reversing_valve'
              ] as const
            ).map((code) => (
              <Field key={code} label={referenceCatalog[code].label}>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder={String(referenceCatalog[code].minimum)}
                  value={policy.laborOverrides[code] ?? ''}
                  onChange={(e) => {
                    const overrides = { ...policy.laborOverrides }
                    if (e.target.value) overrides[code] = Number(e.target.value)
                    else delete overrides[code]
                    setPolicy({ ...policy, laborOverrides: overrides })
                  }}
                />
              </Field>
            ))}
          </div>
          <Field label="Motivo y evidencia de la decisión financiera">
            <Input
              aria-label="Motivo y evidencia de la decisión financiera"
              value={policyReason}
              onChange={(event) => setPolicyReason(event.target.value)}
            />
          </Field>
          <Button
            className="mt-4"
            disabled={busy || policyReason.trim().length < 15}
            onClick={() => void savePolicy()}
          >
            Guardar configuración validada
          </Button>
        </details>
      ) : null}
      <SavedQuotes
        internal
        canReview={canOperations}
        revision={revision}
        onRecalculate={
          canOperations
            ? (row) => {
                setReplaces({ id: row.id, version: row.version })
                setRevisionReason('')
                setManualRouteReason('')
                setInput(row.input)
                setAddress(row.address)
                setCustomerId(row.customer_id)
                setDate(tomorrow())
                setMaterialPrice(row.input.materials?.[0]?.unitPrice ?? 0)
                setMaterialQuantity(row.input.materials?.[0]?.quantity ?? 1)
                setMaterialDescription(
                  row.input.materials?.[0]?.description ?? 'Materiales relevados'
                )
                setOtherMaterials(row.input.materials?.slice(1) ?? [])
                setManual(Boolean(row.quote.route))
                setRouteConfirmed(false)
                if (row.quote.route) setRoute({ ...row.quote.route, source: 'manual' })
                setRemote(null)
                setNotice(
                  'Se cargó el presupuesto para recalcular una nueva versión. El original se conserva.'
                )
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            : undefined
        }
      />
      <ServiceOffers />
    </fieldset>
  )
}
