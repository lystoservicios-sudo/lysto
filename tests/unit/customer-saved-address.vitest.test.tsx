import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock('@/lib/auth/customer-session', () => ({ readCustomerSession: mocks.session }))
import RequestPage from '@/app/(customer)/app/solicitar/aire-acondicionado/page'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
afterEach(cleanup)
function reachAddress() {
  fireEvent.click(screen.getByRole('radio', { name: /No enfría/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  fireEvent.click(screen.getByRole('radio', { name: /Hace días/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}
describe('saved service address integration', () => {
  it('shows the authenticated address, property type and access details in the request', async () => {
    mocks.session.mockResolvedValue({ kind: 'customer', verified: true, profile: { first_name: 'Ana', last_name: 'Pérez', phone: '+541122334455' }, address: { street: 'San Martín', number: '932', floor: '2', apartment: 'C', city: 'Vicente López', province: 'Buenos Aires', property_type: 'office', has_elevator: true, has_parking: true, stairs_required: false, outdoor_unit_at_height: true, outdoor_unit_on_balcony: true, difficult_access: true } })
    render(await RequestPage())
    reachAddress()
    expect((screen.getByLabelText('Calle') as HTMLInputElement).value).toBe('San Martín')
    expect((screen.getByLabelText('Número') as HTMLInputElement).value).toBe('932')
    expect((screen.getByLabelText('Piso') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('Departamento') as HTMLInputElement).value).toBe('C')
    expect(screen.getByRole('radio', { name: /Oficina/ }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Hay estacionamiento') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('La unidad exterior está en un balcón') as HTMLInputElement).checked).toBe(true)
  })
  it('leaves an absent address empty and requires it before scheduling', () => {
    render(<AirConditioningWizard />)
    reachAddress()
    expect((screen.getByLabelText('Calle') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Número') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Piso') as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
