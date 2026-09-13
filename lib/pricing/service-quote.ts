import { z } from 'zod'
import type { ServiceIssueSlug } from '../domain/types.ts'

const moneyValue = z.number().finite().min(0).max(100_000_000)
export const materialSchema = z.object({ description: z.string().trim().min(2).max(200), unitPrice: moneyValue, quantity: z.number().finite().positive().max(1000) })
export const equipmentSchema = z.object({ capacity: z.number().int().min(1000).max(18000).optional(), technology: z.enum(['conventional', 'inverter', 'unknown']).default('unknown') })
export const accessSchema = z.object({ hasElevator: z.boolean().optional(), hasParking: z.boolean().optional(), stairsRequired: z.boolean().optional(), outdoorUnitAtHeight: z.boolean().optional(), outdoorUnitOnBalcony: z.boolean().optional(), difficultAccess: z.boolean().optional() })
export const routeSchema = z.object({
  source: z.enum(['google', 'manual', 'simulation']), origin: z.string().min(1), destination: z.string().min(1),
  province: z.enum(['CABA', 'Buenos Aires', 'other']), outboundKm: z.number().finite().nonnegative().max(1000), returnKm: z.number().finite().nonnegative().max(1000),
  outboundMinutes: z.number().finite().nonnegative().max(1440), returnMinutes: z.number().finite().nonnegative().max(1440),
  tolls: moneyValue, tollsVerified: z.boolean(), measuredAt: z.string().datetime()
})
export type TravelEstimate = z.infer<typeof routeSchema>

// Transcribed from the user supplied CAIM June–July 2026 image. Null is an absent
// upper bound, never zero. These are labor references, not supplier prices.
export const referenceCatalog = {
  maintenance: { label: 'Limpieza y mantenimiento sin desinstalación', minimum: 140000, maximum: null },
  deep_maintenance: { label: 'Limpieza y mantenimiento con desinstalación', minimum: 200000, maximum: null },
  leak: { label: 'Detección de fuga y carga de gas (mano de obra)', minimum: 200000, maximum: null },
  board: { label: 'Sustitución de plaqueta universal (mano de obra)', minimum: 150000, maximum: null },
  capacitor: { label: 'Recambio de capacitor (mano de obra)', minimum: 150000, maximum: null },
  reversing_valve: { label: 'Recambio de válvula inversora (mano de obra)', minimum: 290000, maximum: null },
  uninstall: { label: 'Desinstalación hasta 6000 frigorías/h', minimum: 140000, maximum: 160000 },
  installation: { label: 'Instalación según capacidad (mano de obra)', minimum: 180000, maximum: 400000 },
  compressor: { label: 'Recambio de compresor: cotizar según el repuesto', minimum: null, maximum: null }
} as const
export type ScenarioCode = keyof typeof referenceCatalog
export const scenarioCodes: Record<ServiceIssueSlug, readonly ScenarioCode[]> = {
  no_enfria: ['leak', 'maintenance', 'capacitor', 'compressor'],
  pierde_agua: ['maintenance', 'deep_maintenance'],
  hace_ruido: ['maintenance', 'deep_maintenance', 'compressor'],
  no_enciende: ['board', 'capacitor', 'compressor'],
  no_funciona_calor: ['reversing_valve', 'leak', 'board'],
  instalacion: ['installation'], mantenimiento: ['maintenance', 'deep_maintenance']
}
export const quoteInputSchema = z.object({
  issue: z.enum(['no_enfria', 'pierde_agua', 'hace_ruido', 'no_enciende', 'no_funciona_calor', 'instalacion', 'mantenimiento']),
  timeSince: z.enum(['today', 'days', 'weeks', 'months']).default('days'), urgency: z.enum(['flexible', 'priority']),
  propertyType: z.enum(['house', 'apartment', 'commercial', 'office']), access: accessSchema,
  equipment: equipmentSchema.optional(), route: routeSchema.optional(), scenario: z.enum(['maintenance', 'deep_maintenance', 'leak', 'board', 'capacitor', 'reversing_valve', 'uninstall', 'installation', 'compressor']).optional(),
  materials: z.array(materialSchema).max(50).default([]), materialsConfirmed: z.boolean().default(false)
})
export type QuoteInput = z.input<typeof quoteInputSchema>

export const quotePolicySchema = z.object({
  version: z.string().min(1).max(100), source: z.string().min(1).max(300), sourceDate: z.string().date(), approvedUntil: z.string().date().nullable(),
  safetyRate: z.literal(0.30), platformFeeRate: z.number().finite().min(0).max(0.5), paymentCostRate: z.number().finite().min(0).max(0.5),
  priorityMultiplier: z.number().finite().min(1.01).max(2), laborIndex: z.number().finite().min(1).max(10),
  perKm: moneyValue, perMinute: moneyValue, minimumTravel: moneyValue,
  difficultAccess: moneyValue, height: moneyValue, stairs: moneyValue, noParking: moneyValue,
  commercial: moneyValue, office: moneyValue, inverterRate: z.number().finite().min(0).max(1),
  quoteValidityMinutes: z.number().int().min(5).max(1440),
  laborOverrides: z.record(z.enum(['maintenance','deep_maintenance','leak','board','capacitor','reversing_valve','uninstall','installation_2250','installation_4500','installation_6000','installation_8000','installation_9000','installation_18000']), moneyValue.positive()).default({})
})
export type QuotePolicy = z.infer<typeof quotePolicySchema>
export const defaultQuotePolicy: QuotePolicy = {
  version: 'caim-2026-06-07-lysto-v1', source: 'Imagen CAIM junio–julio 2026 aportada por el usuario', sourceDate: '2026-07-31', approvedUntil: null,
  safetyRate: 0.30, platformFeeRate: 0.18, paymentCostRate: 0.06, priorityMultiplier: 1.25, laborIndex: 1,
  perKm: 700, perMinute: 300, minimumTravel: 10000,
  difficultAccess: 20000, height: 40000, stairs: 10000, noParking: 5000, commercial: 20000, office: 10000, inverterRate: 0.15,
  quoteValidityMinutes: 30, laborOverrides: {}
}
export const reviewReasonLabels: Record<string, string> = {
  tariffs_unapproved: 'Tarifas y costos pendientes de validación comercial', travel_unverified: 'Traslado pendiente de verificación', travel_stale: 'El cálculo del viaje debe actualizarse',
  outside_coverage: 'Domicilio fuera de cobertura', tolls_unverified: 'Peajes pendientes de confirmar', materials_unconfirmed: 'Repuestos y materiales pendientes de cotizar',
  equipment_unknown: 'Falta confirmar capacidad o tecnología del equipo', specialist_access: 'Acceso especial: confirmar recursos con el profesional',
  diagnosis_required: 'El alcance de reparación requiere confirmación técnica', professional_net_floor: 'El neto estimado del profesional después del costo de Mercado Pago no cubre los costos calculados: revisar la comisión y los costos antes de ofrecer', platform_cost_floor: 'Los costos de cobro superan la comisión disponible'
}
export function money(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) throw new Error('invalid_money')
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateServiceQuote(raw: QuoteInput, rawPolicy: QuotePolicy = defaultQuotePolicy, now = new Date()) {
  const input = quoteInputSchema.parse(raw)
  const policy = quotePolicySchema.parse(rawPolicy)
  if (!Number.isFinite(now.getTime())) throw new Error('invalid_quote_date')
  const scenario = input.scenario ?? scenarioCodes[input.issue][0]
  if (!scenarioCodes[input.issue].includes(scenario)) throw new Error('scenario_not_applicable')
  const reference = referenceCatalog[scenario]
  if (reference.minimum === null) throw new Error('manual_quote_required:compresor y repuesto compatibles')
  const reviewReasons: string[] = []
  if (!policy.approvedUntil || Date.parse(`${policy.approvedUntil}T23:59:59Z`) < now.getTime()) reviewReasons.push('tariffs_unapproved')
  let laborReference: number = reference.maximum ?? reference.minimum
  if (scenario === 'installation') {
    const capacity = input.equipment?.capacity ?? 4500
    laborReference = capacity <= 2250 ? 200000 : capacity <= 4500 ? 240000 : capacity <= 6000 ? 260000 : capacity <= 8000 ? 280000 : capacity <= 9000 ? 300000 : 400000
    const bucket = capacity <= 2250 ? 2250 : capacity <= 4500 ? 4500 : capacity <= 6000 ? 6000 : capacity <= 8000 ? 8000 : capacity <= 9000 ? 9000 : 18000
    laborReference = policy.laborOverrides[`installation_${bucket}`] ?? laborReference
  } else {
    if (scenario !== 'compressor') laborReference = policy.laborOverrides[scenario] ?? laborReference
  }
  const labor = money(laborReference * policy.laborIndex)
  if (!input.equipment?.capacity || !input.equipment.technology || input.equipment.technology === 'unknown') reviewReasons.push('equipment_unknown')
  const adjustments: Array<{ code: string; label: string; amount: number }> = []
  const add = (code: string, label: string, amount: number) => { if (amount) adjustments.push({ code, label, amount: money(amount) }) }
  if (input.access.difficultAccess) add('access:difficult', 'Acceso complicado', policy.difficultAccess)
  if (input.access.outdoorUnitAtHeight) add('access:height', 'Trabajo en altura', policy.height)
  if (input.access.difficultAccess || input.access.outdoorUnitAtHeight) reviewReasons.push('specialist_access')
  if (input.access.stairsRequired) add('access:stairs', 'Acceso por escalera', policy.stairs)
  if (input.access.hasParking === false) add('access:no_parking', 'Estacionamiento y descarga', policy.noParking)
  if (input.propertyType === 'commercial') add('property:commercial', 'Local comercial', policy.commercial)
  if (input.propertyType === 'office') add('property:office', 'Oficina', policy.office)
  if (input.equipment?.technology === 'inverter') add('equipment:inverter', 'Complejidad inverter', labor * policy.inverterRate)
  const serviceCost = money(labor + adjustments.reduce((sum, line) => sum + line.amount, 0))
  const urgencyAmount = input.urgency === 'priority' ? money(serviceCost * (policy.priorityMultiplier - 1)) : 0
  add('urgency:priority', 'Prioridad sobre mano de obra y dificultad', urgencyAmount)
  const materialsAmount = money(input.materials.reduce((sum, line) => sum + money(line.unitPrice * line.quantity), 0))
  if (!input.materialsConfirmed) reviewReasons.push('materials_unconfirmed')
  const route = input.route
  const coverage = !route ? 'unknown' : route.province === 'other' || route.outboundMinutes > 180 ? 'outside' : 'covered'
  if (coverage === 'outside') reviewReasons.push('outside_coverage')
  if (!route || route.source !== 'google') reviewReasons.push('travel_unverified')
  if (route && (now.getTime() - Date.parse(route.measuredAt) > 30 * 60_000 || Date.parse(route.measuredAt) > now.getTime() + 60_000)) reviewReasons.push('travel_stale')
  if (route && !route.tollsVerified) reviewReasons.push('tolls_unverified')
  const travel = route ? money(Math.max(policy.minimumTravel, (route.outboundKm + route.returnKm) * policy.perKm + (route.outboundMinutes + route.returnMinutes) * policy.perMinute) + route.tolls) : 0
  if (!['instalacion', 'mantenimiento'].includes(input.issue)) reviewReasons.push('diagnosis_required')
  const calculatorSubtotal = money(serviceCost + urgencyAmount + materialsAmount + travel)
  const safetyAmount = money(calculatorSubtotal * policy.safetyRate)
  const total = money(calculatorSubtotal + safetyAmount)
  const platformFee = money(total * policy.platformFeeRate)
  const professionalAmount = money(total - platformFee)
  if (professionalAmount < calculatorSubtotal) throw new Error('professional_cost_floor')
  const paymentCostBudget = money(total * policy.paymentCostRate)
  if (professionalAmount - paymentCostBudget < calculatorSubtotal) reviewReasons.push('professional_net_floor')
  const platformContribution = platformFee
  return {
    currency: 'ARS' as const, version: policy.version, source: policy.source, sourceDate: policy.sourceDate,
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + policy.quoteValidityMinutes * 60_000).toISOString(),
    issue: input.issue, scenario, scope: reference.label, equipment: input.equipment ?? null, urgency: input.urgency,
    labor, laborReference, adjustments, materials: input.materials, materialsAmount, travel, route: route ?? null,
    calculatorSubtotal, subtotal: calculatorSubtotal, safetyRate: policy.safetyRate, safetyAmount, total,
    platformFeeRate: policy.platformFeeRate, platformFee, professionalAmount, paymentCostBudget, platformContribution,
    coverage, reviewReasons, readyToOffer: reviewReasons.length === 0,
    exclusions: ['Otras fallas y trabajos fuera del alcance indicado', ...(input.materialsConfirmed ? [] : ['Materiales y repuestos sin cotizar']), ...(!route ? ['Traslado todavía sin cotizar'] : []), 'Equipos de elevación y trabajos especiales no relevados'],
    priceKind: 'preliminary' as const
  }
}
export type ServiceQuote = ReturnType<typeof calculateServiceQuote>
