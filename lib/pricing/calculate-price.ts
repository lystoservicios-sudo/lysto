import type { AddressAccessDetails, PropertyType, ServiceIssueSlug, UrgencyLevel } from '../domain/types.ts'

export type PricingRuleSet = {
  currency: 'ARS'
  basePrice: number
  issueAdjustments: Partial<Record<ServiceIssueSlug, number>>
  urgencyMultipliers: Record<UrgencyLevel, number>
  zoneAdjustments: Record<string, number>
  propertyAdjustments: Partial<Record<PropertyType, number>>
  accessAdjustments: {
    difficultAccess: number
    outdoorUnitAtHeight: number
    stairsRequired: number
    noParking: number
  }
  platformFeeRate: number
  minimumPrice: number
}

export type PricingInput = {
  issue: ServiceIssueSlug
  urgency: UrgencyLevel
  zone: string
  propertyType: PropertyType
  access: AddressAccessDetails
}

export type PriceBreakdown = {
  currency: 'ARS'
  subtotal: number
  platformFee: number
  total: number
  professionalAmount: number
  adjustments: Array<{ code: string; label: string; amount: number }>
}

export type PriceOptions = {
  flexible: PriceBreakdown
  priority: PriceBreakdown
}

export const defaultPricingRules: PricingRuleSet = {
  currency: 'ARS',
  basePrice: 35000,
  minimumPrice: 25000,
  issueAdjustments: {
    no_enfria: 0,
    pierde_agua: 0,
    hace_ruido: 0,
    no_enciende: 5000,
    no_funciona_calor: 5000,
    instalacion: 20000,
    mantenimiento: 0
  },
  urgencyMultipliers: { flexible: 1, priority: 1.25 },
  zoneAdjustments: { caba: 0, gba_norte: 5000, gba_sur: 5000, gba_oeste: 5000 },
  propertyAdjustments: { house: 0, apartment: 0, commercial: 8000, office: 6000 },
  accessAdjustments: { difficultAccess: 8000, outdoorUnitAtHeight: 10000, stairsRequired: 4000, noParking: 2500 },
  platformFeeRate: 0.18
}

function roundToHundreds(value: number): number {
  return Math.round(value / 100) * 100
}

export function calculatePrice(input: PricingInput, rules: PricingRuleSet = defaultPricingRules): PriceBreakdown {
  const adjustments: PriceBreakdown['adjustments'] = []
  let subtotal = rules.basePrice

  const issueAdjustment = rules.issueAdjustments[input.issue] ?? 0
  if (issueAdjustment) {
    subtotal += issueAdjustment
    adjustments.push({ code: `issue:${input.issue}`, label: 'Ajuste por tipo de problema', amount: issueAdjustment })
  }

  const zoneAdjustment = rules.zoneAdjustments[input.zone] ?? 0
  if (zoneAdjustment) {
    subtotal += zoneAdjustment
    adjustments.push({ code: `zone:${input.zone}`, label: 'Ajuste por zona', amount: zoneAdjustment })
  }

  const propertyAdjustment = rules.propertyAdjustments[input.propertyType] ?? 0
  if (propertyAdjustment) {
    subtotal += propertyAdjustment
    adjustments.push({ code: `property:${input.propertyType}`, label: 'Ajuste por tipo de propiedad', amount: propertyAdjustment })
  }

  if (input.access.difficultAccess) {
    subtotal += rules.accessAdjustments.difficultAccess
    adjustments.push({ code: 'access:difficult', label: 'Acceso complicado', amount: rules.accessAdjustments.difficultAccess })
  }
  if (input.access.outdoorUnitAtHeight) {
    subtotal += rules.accessAdjustments.outdoorUnitAtHeight
    adjustments.push({ code: 'access:height', label: 'Unidad exterior en altura', amount: rules.accessAdjustments.outdoorUnitAtHeight })
  }
  if (input.access.stairsRequired) {
    subtotal += rules.accessAdjustments.stairsRequired
    adjustments.push({ code: 'access:stairs', label: 'Acceso por escalera', amount: rules.accessAdjustments.stairsRequired })
  }
  if (input.access.hasParking === false) {
    subtotal += rules.accessAdjustments.noParking
    adjustments.push({ code: 'access:no_parking', label: 'Sin estacionamiento', amount: rules.accessAdjustments.noParking })
  }

  subtotal = Math.max(rules.minimumPrice, subtotal)
  subtotal = roundToHundreds(subtotal * rules.urgencyMultipliers[input.urgency])

  const platformFee = roundToHundreds(subtotal * rules.platformFeeRate)
  const total = roundToHundreds(subtotal)
  const professionalAmount = Math.max(0, total - platformFee)

  if (total < 0 || professionalAmount < 0) throw new Error('Invalid negative price calculation')
  return { currency: rules.currency, subtotal, platformFee, total, professionalAmount, adjustments }
}

export function calculatePriceOptions(input: Omit<PricingInput, 'urgency'>, rules: PricingRuleSet = defaultPricingRules): PriceOptions {
  const flexible = calculatePrice({ ...input, urgency: 'flexible' }, rules)
  const priority = calculatePrice({ ...input, urgency: 'priority' }, rules)
  if (priority.total <= flexible.total) throw new Error('Priority price must be greater than flexible price')
  return { flexible, priority }
}
