import { describe, expect, it } from 'vitest'
import inventory from '../../docs/architecture/api-inventory.json'

describe('API inventory contract', () => {
  it('contains one unique disposition for every exported application method', () => {
    expect(inventory.count).toBe(inventory.entries.length)
    expect(new Set(inventory.entries.map((e) => `${e.method} ${e.route}`)).size).toBe(
      inventory.count
    )
    expect(inventory.entries.every((e) => e.authority && e.canonicalDestination && e.test)).toBe(
      true
    )
  })
  it('keeps caller-controlled payment application permanently retired', () => {
    expect(inventory.entries.find((e) => e.route === '/api/payments/webhook/apply')).toMatchObject({
      method: 'POST',
      status: 'retired',
      canonicalDestination: '/api/mercadopago/webhook'
    })
  })
  it('has no successful placeholder disposition', () => {
    expect(
      inventory.entries.some((e) => String(e.status).match(/placeholder|accepted|simulated/))
    ).toBe(false)
  })
})
