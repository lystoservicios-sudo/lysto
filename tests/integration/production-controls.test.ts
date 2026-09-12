import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { createFixtureAccounts } from './fixtures'

describe('shared production controls', () => {
  const setup = createFixtureAccounts()
  let fixture: Awaited<typeof setup>
  const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const key = `quote:${randomUUID().replaceAll('-', '')}`
  const serviceClient = () =>
    createClient(process.env.LYSTO_TEST_SUPABASE_URL!, process.env.LYSTO_TEST_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  beforeAll(async () => {
    fixture = await setup
    await db.connect()
  })
  afterAll(async () => {
    try {
      await db.query('delete from private.rate_limit_buckets where key=$1', [key])
    } finally {
      await db.end()
      await setup.cleanup()
    }
  })
  it('shares one counter across independent application clients', async () => {
    const first = await serviceClient().rpc('consume_rate_limit', {
      p_key: key,
      p_limit: 1,
      p_window_seconds: 60
    })
    const second = await serviceClient().rpc('consume_rate_limit', {
      p_key: key,
      p_limit: 1,
      p_window_seconds: 60
    })
    expect(first.error).toBeNull()
    expect(first.data).toMatchObject({ allowed: true, remaining: 0 })
    expect(second.error).toBeNull()
    expect(second.data).toMatchObject({ allowed: false, remaining: 0 })
    expect((second.data as { retryAfter: number }).retryAfter).toBeGreaterThan(0)
  })
  it('denies rate-limit and readiness procedures to authenticated users', async () => {
    const consume = await fixture.accounts.customerA.client.rpc('consume_rate_limit', {
      p_key: key,
      p_limit: 1,
      p_window_seconds: 60
    })
    const probe = await fixture.accounts.customerA.client.rpc('production_readiness_probe')
    expect(consume.error?.code).toBe('42501')
    expect(probe.error?.code).toBe('42501')
  })
})
