import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { parsePublicEnv, parseServerEnv, redactEnvForLogs } from '../../lib/config/env'
import { assertPublicSupabaseEnv, getPublicSupabaseEnv } from '../../lib/supabase/env'

const publicEnv = {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key'
}

const serverEnv = {
  ...publicEnv,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret'
}

describe('parsePublicEnv', () => {
  it('requires valid application and Supabase URLs', () => {
    expect(() => parsePublicEnv({
      ...publicEnv,
      NEXT_PUBLIC_APP_URL: 'not-a-url',
      NEXT_PUBLIC_SUPABASE_URL: 'also-not-a-url'
    })).toThrow(/NEXT_PUBLIC_APP_URL/)
    expect(() => parsePublicEnv({
      ...publicEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url'
    })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('requires a non-empty publishable or legacy anon key', () => {
    expect(() => parsePublicEnv({
      ...publicEnv,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '   '
    })).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  })

  it('normalizes the legacy anon key without exposing server credentials', () => {
    const parsed = parsePublicEnv({
      NEXT_PUBLIC_APP_URL: publicEnv.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'must-not-be-public'
    })

    expect(parsed).toEqual({
      appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
      supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      supabasePublishableKey: 'legacy-anon-key'
    })
    expect(JSON.stringify(parsed)).not.toContain('must-not-be-public')
  })
})

describe('parseServerEnv', () => {
  it('accepts split configuration without requiring a platform access token and keeps its secrets redacted',()=>{
    const parsed=parseServerEnv({...serverEnv,PAYMENTS_PROVIDER:'mercadopago_split',MERCADOPAGO_MODE:'test',MERCADOPAGO_DATABASE_URL:'postgres://private-db',MERCADOPAGO_ENCRYPTION_KEY:'private-cipher-key',MERCADOPAGO_WEBHOOK_SECRET:'private-hook',MERCADOPAGO_MARKETPLACE_CLIENT_ID:'123',MERCADOPAGO_MARKETPLACE_CLIENT_SECRET:'private-client-secret'})
    expect(parsed.payments.provider).toBe('mercadopago_split');expect(JSON.stringify(redactEnvForLogs(parsed))).not.toContain('private-')
  })
  it('requires the Supabase service role key', () => {
    expect(() => parseServerEnv(publicEnv)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('uses safe disabled defaults without validating provider credentials', () => {
    const parsed = parseServerEnv({
      ...serverEnv,
      AI_PROVIDER: ''
    })

    expect(parsed.payments).toEqual({ provider: 'mock' })
    expect(parsed.email).toEqual({ enabled: false })
    expect(parsed.whatsapp).toEqual({ enabled: false })
    expect(parsed.ai).toEqual({ enabled: false })
  })

  it('parses explicit false flags as false and rejects truthy-looking alternatives', () => {
    const parsed = parseServerEnv({
      ...serverEnv,
      NOTIFICATIONS_EMAIL_ENABLED: 'false',
      WHATSAPP_ENABLED: 'false',
      AI_ENABLED: 'false'
    })

    expect(parsed.email.enabled).toBe(false)
    expect(parsed.whatsapp.enabled).toBe(false)
    expect(parsed.ai.enabled).toBe(false)
    expect(() => parseServerEnv({
      ...serverEnv,
      NOTIFICATIONS_EMAIL_ENABLED: 'yes'
    })).toThrow(/NOTIFICATIONS_EMAIL_ENABLED/)
  })

  it('requires every Mercado Pago variable only for that provider', () => {
    expect(() => parseServerEnv({
      ...serverEnv,
      PAYMENTS_PROVIDER: 'mercadopago'
    })).toThrow(/MERCADOPAGO_ACCESS_TOKEN/)

    const parsed = parseServerEnv({
      ...serverEnv,
      PAYMENTS_PROVIDER: 'mercadopago',
      MERCADOPAGO_PUBLIC_KEY: 'mp-public-key',
      MERCADOPAGO_ACCESS_TOKEN: 'mp-access-token',
      MERCADOPAGO_WEBHOOK_SECRET: 'mp-webhook-secret',
      MERCADOPAGO_MARKETPLACE_CLIENT_ID: 'mp-client-id',
      MERCADOPAGO_MARKETPLACE_CLIENT_SECRET: 'mp-client-secret'
    })

    expect(parsed.payments.provider).toBe('mercadopago')
  })

  it('requires email, WhatsApp and AI variables only when enabled', () => {
    expect(() => parseServerEnv({
      ...serverEnv,
      NOTIFICATIONS_EMAIL_ENABLED: 'true'
    })).toThrow(/RESEND_API_KEY/)
    expect(() => parseServerEnv({
      ...serverEnv,
      WHATSAPP_ENABLED: 'true'
    })).toThrow(/WHATSAPP_API_TOKEN/)
    expect(() => parseServerEnv({
      ...serverEnv,
      AI_ENABLED: 'true'
    })).toThrow(/AI_PROVIDER/)
    expect(() => parseServerEnv({
      ...serverEnv,
      AI_ENABLED: 'true',
      AI_PROVIDER: 'unsupported',
      OPENAI_API_KEY: 'ai-secret'
    })).toThrow(/AI_PROVIDER/)

    const parsed = parseServerEnv({
      ...serverEnv,
      NOTIFICATIONS_EMAIL_ENABLED: 'true',
      RESEND_API_KEY: 'resend-secret',
      WHATSAPP_ENABLED: 'true',
      WHATSAPP_API_TOKEN: 'whatsapp-secret',
      WHATSAPP_PHONE_NUMBER_ID: 'phone-number-id',
      AI_ENABLED: 'true',
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-secret'
    })

    expect(parsed.email.enabled).toBe(true)
    expect(parsed.whatsapp.enabled).toBe(true)
    expect(parsed.ai.enabled).toBe(true)
  })
})

describe('redactEnvForLogs', () => {
  it('never returns credential values', () => {
    const credentialValues = [
      'public-key',
      'service-role-secret',
      'mp-public-key',
      'mp-access-token',
      'mp-webhook-secret',
      'mp-client-id',
      'mp-client-secret',
      'resend-secret',
      'whatsapp-secret',
      'phone-number-id',
      'openai-secret'
    ]
    const parsed = parseServerEnv({
      ...serverEnv,
      PAYMENTS_PROVIDER: 'mercadopago',
      MERCADOPAGO_PUBLIC_KEY: 'mp-public-key',
      MERCADOPAGO_ACCESS_TOKEN: 'mp-access-token',
      MERCADOPAGO_WEBHOOK_SECRET: 'mp-webhook-secret',
      MERCADOPAGO_MARKETPLACE_CLIENT_ID: 'mp-client-id',
      MERCADOPAGO_MARKETPLACE_CLIENT_SECRET: 'mp-client-secret',
      NOTIFICATIONS_EMAIL_ENABLED: 'true',
      RESEND_API_KEY: 'resend-secret',
      WHATSAPP_ENABLED: 'true',
      WHATSAPP_API_TOKEN: 'whatsapp-secret',
      WHATSAPP_PHONE_NUMBER_ID: 'phone-number-id',
      AI_ENABLED: 'true',
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-secret'
    })

    const serialized = JSON.stringify(redactEnvForLogs(parsed))

    credentialValues.forEach((value) => expect(serialized).not.toContain(value))
    expect(serialized).toContain('[REDACTED]')
  })
})

describe('Supabase environment adapter', () => {
  it('does not parse public configuration during module import', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')

    try {
      await expect(import('../../lib/supabase/env')).resolves.toEqual(expect.objectContaining({
        getPublicSupabaseEnv: expect.any(Function),
        assertPublicSupabaseEnv: expect.any(Function)
      }))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('keeps direct public process.env references for Next.js inlining', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'lib/supabase/env.ts'),
      'utf8'
    )
    const publicNames = [
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ]

    publicNames.forEach((name) => {
      expect(source).toContain(`${name}: process.env.${name}`)
    })
    expect(source).not.toMatch(/EnvSource\s*=\s*process\.env/)
    expect(source).not.toContain('process.env.SUPABASE_SERVICE_ROLE_KEY')
  })

  it('keeps the existing public shape while delegating validation', () => {
    expect(getPublicSupabaseEnv(publicEnv)).toEqual({
      url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    })
    expect(() => assertPublicSupabaseEnv({})).toThrow(/NEXT_PUBLIC_APP_URL/)
  })
})
