import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MarketplaceAccount } from '@/components/payments/marketplace-account'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('shows only the account-link action and brief authorization guidance during onboarding', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    configured: true, linked: false, mode: 'live'
  }))))

  render(<MarketplaceAccount onboarding />)

  await waitFor(() => expect(screen.getByRole('button', { name: 'Vincular cuenta con Mercado Pago' })).toBeTruthy())
  expect(screen.getAllByRole('button')).toHaveLength(1)
  expect(screen.getByText(/iniciá sesión en Mercado Pago/i)).toBeTruthy()
  expect(screen.queryByText('Cómo se reparte cada pago')).toBeNull()
  expect(screen.queryByText('Ambiente de producción.')).toBeNull()
  expect(screen.queryByText('Desconectar de Lysto')).toBeNull()
})

it('does not offer a dead link when production OAuth is not configured', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    configured: false, linked: null
  }))))

  render(<MarketplaceAccount onboarding />)

  await waitFor(() => expect(screen.getByRole('button', { name: 'Vincular cuenta con Mercado Pago' }).hasAttribute('disabled')).toBe(true))
  expect(screen.getByRole('alert').textContent).toContain('La vinculación todavía no está disponible')
})
