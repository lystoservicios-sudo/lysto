import { test, expect } from '../_lib/test.ts'
import { calculatePrice, calculatePriceOptions, defaultPricingRules } from '../../lib/pricing/calculate-price.ts'

test('calcula flexible base para CABA sin ajustes', () => {
  const price = calculatePrice({ issue: 'no_enfria', urgency: 'flexible', zone: 'caba', propertyType: 'apartment', access: { hasParking: true } })
  expect(price.total).toBe(35000)
  expect(price.platformFee).toBe(6300)
  expect(price.professionalAmount).toBe(28700)
})

test('prioridad siempre supera flexible', () => {
  const prices = calculatePriceOptions({ issue: 'no_enfria', zone: 'caba', propertyType: 'apartment', access: {} })
  expect(prices.priority.total).toBeGreaterThan(prices.flexible.total)
})

test('instalacion aplica ajuste de 20000', () => {
  const price = calculatePrice({ issue: 'instalacion', urgency: 'flexible', zone: 'caba', propertyType: 'apartment', access: {} })
  expect(price.total).toBe(55000)
})

test('acceso complicado y altura ajustan precio', () => {
  const price = calculatePrice({ issue: 'no_enfria', urgency: 'flexible', zone: 'caba', propertyType: 'apartment', access: { difficultAccess: true, outdoorUnitAtHeight: true } })
  expect(price.total).toBe(53000)
})

test('sin estacionamiento agrega ajuste', () => {
  const price = calculatePrice({ issue: 'no_enfria', urgency: 'flexible', zone: 'caba', propertyType: 'apartment', access: { hasParking: false } })
  expect(price.total).toBe(37500)
})

test('respeta precio minimo', () => {
  const price = calculatePrice({ issue: 'no_enfria', urgency: 'flexible', zone: 'caba', propertyType: 'house', access: {} }, { ...defaultPricingRules, basePrice: 1000, minimumPrice: 25000 })
  expect(price.total).toBe(25000)
})
