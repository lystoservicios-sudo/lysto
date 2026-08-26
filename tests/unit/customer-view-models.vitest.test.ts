import { describe, expect, it } from 'vitest'

import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import { findCustomerRecordById } from '@/features/customer/view-models'

describe('customer view model contracts', () => {
  it('finds a record by route id without falling back to the first item', () => {
    const selected = findCustomerRecordById(customerDemoFixtures.equipment, 'eq_demo_bedroom')

    expect(selected?.id).toBe('eq_demo_bedroom')
    expect(findCustomerRecordById(customerDemoFixtures.equipment, 'missing')).toBeNull()
  })

  it('labels fixture data explicitly as demo content', () => {
    expect(customerDemoFixtures.meta.kind).toBe('demo')
    expect(customerDemoFixtures.meta.label).toContain('demostración')
  })

  it('keeps customer payment fixtures empty while the integration is deferred', () => {
    expect(customerDemoFixtures.payments.integrationState).toBe('deferred')
    expect(customerDemoFixtures.payments.movements).toEqual([])
  })
})
