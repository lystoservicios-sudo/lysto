import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'
import { OWNER_TEST_CUSTOMER_EMAIL } from '@/lib/pricing/owner-maintenance-test-price'

const mocks = vi.hoisted(() => ({ session: vi.fn(), addresses: vi.fn(), identity: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: mocks.session }))
vi.mock('@/lib/customer-assets/service', () => ({ listCustomerAddresses: mocks.addresses }))

import RequestAirConditioningPage from '../../app/(customer)/app/solicitar/aire-acondicionado/page'

const authority = { role: 'customer', profileId: 'current-customer', client: { auth: { getUser: mocks.identity } } }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue(authority)
  mocks.addresses.mockResolvedValue({ items: [], total: 0, nextCursor: null })
  mocks.identity.mockResolvedValue({ data: { user: { email: 'customer@example.test' } } })
})
afterEach(cleanup)

describe('customer request entry from Inicio', () => {
  it.each(AIR_CONDITIONING_ISSUES)('validates and selects the $title shortcut', async ({ slug, title }) => {
    render(await RequestAirConditioningPage({ searchParams: Promise.resolve({ problema: slug }) }))

    expect(screen.getByRole('radio', { name: new RegExp(title) }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Paso 1 de 7')).toBeTruthy()
    expect(mocks.session).toHaveBeenCalledWith('customer')
    expect(mocks.addresses).toHaveBeenCalledWith(authority)
  })

  it.each([
    { problema: undefined },
    { problema: '' },
    { problema: 'otro_problema' },
    { problema: 'NO_ENFRIA' },
    { problema: ['no_enfria'] },
    { problema: ['no_enfria', 'mantenimiento'] }
  ])(
    'keeps the first choice empty for an invalid or repeated parameter $problema',
    async ({ problema }) => {
      render(await RequestAirConditioningPage({ searchParams: Promise.resolve({ problema }) }))

      expect(screen.getAllByRole('radio').every((option) => option.getAttribute('aria-checked') === 'false')).toBe(true)
      expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
    }
  )

  it('preserves saved addresses and owner-maintenance eligibility with a shortcut', async () => {
    const savedAddresses = { items: [], total: 0, nextCursor: null }
    mocks.addresses.mockResolvedValue(savedAddresses)
    mocks.identity.mockResolvedValue({ data: { user: { email: OWNER_TEST_CUSTOMER_EMAIL } } })

    const page = await RequestAirConditioningPage({ searchParams: Promise.resolve({ problema: 'mantenimiento' }) })

    expect(page.props.children.props.savedAddresses).toBe(savedAddresses)
    expect(page.props.children.props.ownerMaintenanceTestCustomer).toBe(true)
  })

  it('does not read identity or addresses without an authorized customer session', async () => {
    mocks.session.mockRejectedValue(new Error('REDIRECT:/login'))

    await expect(RequestAirConditioningPage({ searchParams: Promise.resolve({ problema: 'no_enfria' }) })).rejects.toThrow('REDIRECT:/login')
    expect(mocks.identity).not.toHaveBeenCalled()
    expect(mocks.addresses).not.toHaveBeenCalled()
  })
})
