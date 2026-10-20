import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser, signOut: mocks.signOut }, rpc: mocks.rpc })
}))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) }
}))
vi.mock('../../app/(auth)/login/login-form', () => ({ LoginForm: () => <form aria-label="Ingresar" /> }))
vi.mock('@/components/auth/customer-forms', () => ({ EmailHelpForm: () => null }))
import LoginPage from '../../app/(auth)/login/page'
import StaffLoginPage from '../../app/(auth)/equipo/login/page'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: {
    email_confirmed_at: '2026-10-20', app_metadata: { app_role: 'customer' }
  } }, error: null })
  mocks.rpc.mockResolvedValue({ data: { role: 'customer', session_active: true }, error: null })
})
afterEach(cleanup)

it('returns an already signed-in customer to the dashboard instead of showing login again', async () => {
  await expect(LoginPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT:/app')
  expect(mocks.signOut).not.toHaveBeenCalled()
})
it('preserves a safe requested customer destination', async () => {
  await expect(LoginPage({ searchParams: Promise.resolve({ next: '/app/hogar' }) })).rejects.toThrow('REDIRECT:/app/hogar')
})
it.each(['https://attacker.test', '//attacker.test', '/admin'])('rejects an unsafe destination %s for a signed-in customer', async next => {
  await expect(LoginPage({ searchParams: Promise.resolve({ next }) })).rejects.toThrow('REDIRECT:/app')
})
it.each(['customer', 'professional', 'admin'])('keeps an existing %s session on its own panel', async role => {
  mocks.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: '2026-10-20', app_metadata: { app_role: role } } }, error: null })
  mocks.rpc.mockResolvedValue({ data: { role, session_active: true }, error: null })
  const destination = role === 'customer' ? '/app' : role === 'professional' ? '/pro/dashboard' : '/admin/dashboard'
  await expect(StaffLoginPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(`REDIRECT:${destination}`)
  expect(mocks.signOut).not.toHaveBeenCalled()
})
it('keeps the login form available for a signed-out visitor', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  render(await LoginPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByRole('form', { name: 'Ingresar' })).toBeTruthy()
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('does not redirect a revoked session back into a login loop', async () => {
  mocks.rpc.mockResolvedValue({ data: { role: 'customer', session_active: false }, error: null })
  render(await LoginPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByRole('form', { name: 'Ingresar' })).toBeTruthy()
  expect(mocks.signOut).not.toHaveBeenCalled()
})
it('keeps login readable when authentication is temporarily unavailable', async () => {
  mocks.getUser.mockRejectedValue(new Error('provider unavailable'))
  render(await LoginPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByRole('form', { name: 'Ingresar' })).toBeTruthy()
})
