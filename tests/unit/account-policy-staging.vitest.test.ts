// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: fixtures.rpc })
}))
vi.mock('@/lib/supabase/env', () => ({
  assertPublicSupabaseEnv: () => ({ url: 'https://staging.supabase.co' })
}))

import { getRegistrationPolicy } from '@/lib/auth/account-policy'

const legal = {
  terms_version: '2026-09-21',
  privacy_version: '2026-09-21',
  terms_url: 'https://lystohogar.com/terminos',
  privacy_url: 'https://lystohogar.com/privacidad',
  test_only: false
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto-staging-preview.vercel.app')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role')
  vi.stubEnv('APP_ENV', 'staging')
  fixtures.rpc.mockResolvedValue({ data: legal, error: null })
})

describe('staging customer registration policy', () => {
  it('accepts the approved canonical legal pages while the application uses the staging origin', async () => {
    expect(await getRegistrationPolicy()).toMatchObject({
      termsUrl: legal.terms_url,
      privacyUrl: legal.privacy_url
    })
  })

  it('does not accept a third-party legal origin in staging', async () => {
    fixtures.rpc.mockResolvedValue({
      data: { ...legal, terms_url: 'https://attacker.example/terminos' },
      error: null
    })
    expect(await getRegistrationPolicy()).toBeNull()
  })

  it('does not relax the same-origin policy in production', async () => {
    vi.stubEnv('APP_ENV', 'production')
    expect(await getRegistrationPolicy()).toBeNull()
  })
})
