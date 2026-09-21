import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ policy: vi.fn() }))
vi.mock('@/lib/auth/account-policy', () => ({ getRegistrationPolicy: mocks.policy }))

import LoginPage from '../../app/(auth)/login/page'
import RegisterPage from '../../app/(auth)/registro/page'

const legalPolicy = {
  termsVersion: 't1', privacyVersion: 'p1',
  termsUrl: 'https://lysto.test/terminos', privacyUrl: 'https://lysto.test/privacidad',
  testOnly: false
}

beforeEach(() => {
  mocks.policy.mockResolvedValue(legalPolicy)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks() })

function provider(google: boolean) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google } }) }))
}

describe('public customer authentication pages', () => {
  it('does not offer unavailable Google sign-in while retaining email sign-in', async () => {
    provider(false)
    render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByRole('button', { name: 'Continuar con Google' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDefined()
  })

  it('does not offer Google sign-in even if the provider is enabled while Google is postponed', async () => {
    provider(true)
    render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByRole('button', { name: 'Continuar con Google' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDefined()
  })

  it('fails closed when provider settings cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))
    render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByRole('button', { name: 'Continuar con Google' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDefined()
  })

  it('does not offer unavailable Google registration while retaining email registration', async () => {
    provider(false)
    render(await RegisterPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByRole('button', { name: 'Continuar con Google' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Crear mi cuenta' })).toBeDefined()
  })

  it('does not offer Google registration even if the provider and legal policy are enabled', async () => {
    provider(true)
    render(await RegisterPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByRole('button', { name: 'Continuar con Google' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Crear mi cuenta' })).toBeDefined()
  })
})
