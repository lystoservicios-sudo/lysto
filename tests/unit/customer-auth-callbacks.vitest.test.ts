// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn(), resolve: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: mocks }) }))
vi.mock('@/lib/auth/customer-session', () => ({ resolvedCustomerDestination: mocks.resolve }))
import { GET as callback } from '../../app/auth/callback/route'
import { GET as confirm } from '../../app/auth/confirm/route'
beforeEach(() => vi.resetAllMocks())
describe('authentication callbacks', () => {
  it('rejects expired or missing codes without entering the app', async () => {
    const result = await callback(new NextRequest('https://lysto.test/auth/callback'))
    expect(result.headers.get('location')).toBe('https://lysto.test/login?notice=invalid-link')
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled()
  })
  it('handles denied Google authorization without showing raw provider errors', async () => {
    const result = await callback(new NextRequest('https://lysto.test/auth/callback?error=access_denied&error_description=private-provider-message'))
    expect(result.headers.get('location')).toBe('https://lysto.test/login?notice=oauth-error')
  })
  it('exchanges the code then validates customer access and safe redirect', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null })
    mocks.resolve.mockResolvedValue('/completar-perfil?next=%2Fapp')
    const result = await callback(new NextRequest('https://lysto.test/auth/callback?code=one-time-code&next=https://evil.test'))
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('one-time-code')
    expect(mocks.resolve.mock.calls[0][0]).toBe('/app')
    expect(result.headers.get('location')).toBe('https://lysto.test/completar-perfil?next=%2Fapp')
    expect(result.headers.get('cache-control')).toBe('private, no-store')
  })
  it('sends confirmed recovery links to password update', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null })
    const result = await confirm(new NextRequest('https://lysto.test/auth/confirm?token_hash=token&type=recovery&next=//evil.test'))
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token', type: 'recovery' })
    expect(result.headers.get('location')).toBe('https://lysto.test/actualizar-contrasena')
  })
  it('rejects unsupported token flows', async () => {
    const result = await confirm(new NextRequest('https://lysto.test/auth/confirm?token_hash=token&type=invite'))
    expect(mocks.verifyOtp).not.toHaveBeenCalled()
    expect(result.headers.get('location')).toContain('/login?notice=invalid-link')
  })
})
