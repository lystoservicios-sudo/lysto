import { expect, it } from 'vitest'
import { addressInputSchema } from '@/lib/customer-assets/contracts'
import { requestVisitAddress } from '@/lib/jobs/visit-address'

it('projects every canonically allowed postal text length without falling back to history', () => {
  const address = addressInputSchema.parse({ label: 'Visita', street: 'S'.repeat(200), number: 'N'.repeat(30),
    city: 'C'.repeat(100), province: 'CABA', floor: 'F'.repeat(100), apartment: 'A'.repeat(100),
    propertyType: 'apartment', access: {} })
  expect(requestVisitAddress({ contractSource: 'automatic_customer_request', visitAddressSnapshot: address }, 'Old address'))
    .toBe(`${address.street} ${address.number}, Piso ${address.floor} Depto. ${address.apartment}, ${address.city}`)
})

it('fails closed for a postal snapshot outside the canonical input contract', () => {
  expect(requestVisitAddress({ contractSource: 'automatic_customer_request', visitAddressSnapshot: {
    street: 'Street', number: '100', city: 'CABA', floor: 'F'.repeat(101)
  } }, 'Old address')).toBeUndefined()
})
