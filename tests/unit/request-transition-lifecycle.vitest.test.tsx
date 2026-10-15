import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import type { CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'

// Delay the GPU boundary: leaving before its first frame must discard the hero origin.
vi.mock('@/features/service-request/request-location-step', () => ({
  RequestLocationStep: ({ transition }: { transition: unknown }) => <div data-testid="location-boundary" data-transition={!!transition} />
}))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear() })
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const snapshot: CustomerHomesSnapshot = {
  addresses: [{ id: id(2), label: 'Casa', street: 'Visita', number: '100', city: 'CABA', province: 'CABA', propertyType: 'house', access: {}, isDefault: true, version: 1, createdAt: '2026-10-14T12:00:00Z', archivedAt: null }],
  equipment: [{ id: id(3), nickname: 'Aire living', addressId: id(2), equipmentType: 'inverter', brand: null, model: null, serialNumber: null, frigorias: '3000', version: 1, createdAt: '2026-10-14T12:00:00Z', archivedAt: null }],
  homes: [{ id: id(4), addressId: id(2), name: 'Casa', kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'small' }, version: 1,
    floors: [{ id: id(5), name: 'Única planta', order: 0, rooms: [{ id: id(6), name: 'Living', kind: 'living', variant: 'family', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }],
    placements: [{ equipmentId: id(3), roomId: id(6), wall: 'north', offset: .5, height: 2 }] }]
}
it('does not replay an old hero origin when returning to location before the GPU animation completes', () => {
  sessionStorage.clear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 24, y: 140, left: 24, top: 140, right: 384, bottom: 380, width: 360, height: 240, toJSON() { return {} } })
  render(<AirConditioningWizard customerId={id(1)} initialData={snapshot} />)
  fireEvent.click(screen.getByRole('radio', { name: /No enfría/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/ }))
  expect(screen.getByTestId('location-boundary').getAttribute('data-transition')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: /^Continuar con los detalles$/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Atrás$/ }))
  expect(screen.getByTestId('location-boundary').getAttribute('data-transition')).toBe('false')
})
