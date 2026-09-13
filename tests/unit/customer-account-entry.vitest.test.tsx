import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/lib/auth/customer-session', () => ({ readCustomerSession: mocks.read }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) } }))
import CustomerDashboardPage from '../../app/(customer)/app/page'
import CustomerProfilePage from '../../app/(customer)/app/perfil/page'
import CustomerAddressesPage from '../../app/(customer)/app/direcciones/page'

afterEach(cleanup)
const session = { kind: 'customer', verified: true, user: { email: 'ines@example.test' }, profile: { first_name: 'Inés', last_name: 'Prueba', phone: '+541155555555' }, address: { street: 'Calle de prueba', number: '82', city: 'Buenos Aires', province: 'Buenos Aires', floor: '3', apartment: 'A', property_type: 'apartment' } }

describe('real customer account entry', () => {
  it('uses the signed-in identity and address for the initial request entry', async () => {
    mocks.read.mockResolvedValue(session)
    render(await CustomerDashboardPage())
    expect(screen.getByRole('heading', { name: 'Hola, Inés' })).toBeTruthy()
    expect(screen.getByText(/Calle de prueba 82/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Solicitar servicio/ }).getAttribute('href')).toBe('/app/solicitar/aire-acondicionado')
    expect(screen.queryByText(/demostración/i)).toBeNull()
  })
  it('shows saved profile and address information instead of fixtures', async () => {
    mocks.read.mockResolvedValue(session)
    render(await CustomerProfilePage())
    expect(screen.getByText('ines@example.test')).toBeTruthy()
    expect(screen.getByText('Inés Prueba')).toBeTruthy()
    cleanup()
    render(await CustomerAddressesPage())
    expect(screen.getByText(/Calle de prueba 82/)).toBeTruthy()
    expect(screen.getByText(/Piso 3/)).toBeTruthy()
  })
  it('does not render another identity when the session is absent', async () => {
    mocks.read.mockResolvedValue({ kind: 'anonymous' })
    await expect(CustomerDashboardPage()).rejects.toThrow('REDIRECT:/login')
  })
})
