import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { combineChunks, stringFromBase64URL } from '@supabase/ssr'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { createFixtureAccounts } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'

// Every exported method on an active/private or explicitly unavailable API.
export const privateHttpMethods = [
  ['POST', '/api/customer/request/submit'],
  ['GET', '/api/jobs/extras'], ['POST', '/api/jobs/extras'], ['PATCH', '/api/jobs/extras'],
  ['GET', '/api/pricing/job'], ['POST', '/api/pricing/job/status'],
  ['GET', '/api/pricing/offers'], ['POST', '/api/pricing/offers'],
  ['GET', '/api/pricing/policy'], ['PUT', '/api/pricing/policy'],
  ['POST', '/api/pricing/quote'], ['GET', '/api/pricing/quotes'], ['PATCH', '/api/pricing/quotes'],
  ['GET', '/api/mercadopago/account'], ['DELETE', '/api/mercadopago/account'],
  ['GET', '/api/mercadopago/checkouts'], ['POST', '/api/mercadopago/checkouts'],
  ['POST', '/api/mercadopago/create-preference'], ['POST', '/api/mercadopago/oauth/authorize'], ['GET', '/api/mercadopago/oauth/callback'],
  ['POST', '/api/admin/approve-professional'], ['POST', '/api/admin/invite-professional'], ['POST', '/api/admin/pricing/update'], ['POST', '/api/admin/professionals/approve'], ['POST', '/api/admin/professionals/suspend'],
  ['POST', '/api/equipment/register'], ['POST', '/api/jobs/final-report'], ['POST', '/api/maintenance/schedule'], ['POST', '/api/notifications/emit'],
  ['POST', '/api/pro/jobs/action'], ['POST', '/api/pro/onboarding/evaluate'], ['POST', '/api/professional/onboarding'], ['POST', '/api/professional/respond-request'],
  ['POST', '/api/quality/open-case'], ['POST', '/api/reviews/submit'], ['POST', '/api/uploads/sign'], ['POST', '/api/uploads/finalize'], ['POST', '/api/uploads/read'], ['POST', '/api/warranty/claim'], ['POST', '/api/diagnosis/generate']
] as const

describe('HTTP access control with real Auth sessions', () => {
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined
  let fixtures: Awaited<ReturnType<typeof createFixtureAccounts>> | undefined
  let pendingFixtures: ReturnType<typeof createFixtureAccounts> | undefined
  let pendingApp: ReturnType<typeof startTestApp> | undefined
  let database: Client | undefined
  const requestIds = [randomUUID(), randomUUID()]
  const jobIds = [randomUUID(), randomUUID()]
  beforeAll(async () => {
    pendingFixtures = createFixtureAccounts()
    fixtures = await pendingFixtures
    const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
    database = new Client({ connectionString: target.databaseUrl, connectionTimeoutMillis: 5_000 })
    await database.connect()
    await database.query('begin')
    try {
      for (const [index, owner] of [fixtures.accounts.customerA, fixtures.accounts.customerB].entries()) {
        const inserted = await database.query(`insert into public.service_requests (id,customer_id,category_id,issue_type_id,status)
          select $1,$2,c.id,i.id,'pending_assignment' from public.service_categories c join public.service_issue_types i on i.category_id=c.id
          where c.slug='aire_acondicionado' and i.slug='mantenimiento' returning id`, [requestIds[index], owner.entityId])
        if (inserted.rowCount !== 1) throw new Error('The disposable service catalog must be seeded')
        await database.query('insert into public.jobs (id,request_id,customer_id,professional_id,status) values ($1,$2,$3,$4,$5)',
          [jobIds[index], requestIds[index], owner.entityId, index === 0 ? fixtures.accounts.professionalApproved.entityId : null, index === 0 ? 'confirmed' : 'pending_assignment'])
      }
      await database.query('commit')
    } catch (error) { await database.query('rollback'); throw error }
    pendingApp = startTestApp()
    app = await pendingApp
  }, 900_000)
  afterAll(async () => {
    try { await (app ?? await pendingApp?.catch(() => undefined))?.stop() }
    finally {
      try {
        if (database) {
          try { await database.query('delete from public.service_requests where id = any($1::uuid[])', [requestIds]) }
          finally { await database.end() }
        }
      } finally { await pendingFixtures?.cleanup() }
    }
  }, 300_000)

  async function request(method: string, path: string, account?: keyof NonNullable<typeof fixtures>['accounts'], body: unknown = {}) {
    const cookie = account ? await fixtureCookieHeader(fixtures!.accounts[account]) : undefined
    return fetch(new URL(path, app!.baseURL), { method, redirect: 'manual',
      headers: { Origin: app!.baseURL, ...(cookie ? { Cookie: cookie } : {}), 'Content-Type': 'application/json' },
      body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180_000) })
  }

  it.each(privateHttpMethods)('rejects anonymous %s %s before any mutation', async (method, path) => {
    const response = await request(method, path)
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const body = await response.json()
    expect(body.code).toBe('unauthorized')
  }, 240_000)

  it.each(['/app', '/pro/dashboard', '/admin/dashboard'])('does not render private %s for an anonymous visitor', async path => {
    const response = await request('GET', path)
    expect([303, 307, 308]).toContain(response.status)
    expect(new URL(response.headers.get('location')!, app!.baseURL).pathname).toBe('/login')
    expect(response.headers.get('cache-control')).toContain('no-store')
  }, 240_000)

  it.each([
    ['customerA', '/admin/dashboard'], ['customerA', '/pro/dashboard'],
    ['owner', '/app'], ['professionalSuspended', '/pro/dashboard']
  ] as const)('does not grant %s the visual role of %s', async (account, path) => {
    const response = await request('GET', path, account)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toContain('no-store')
  }, 240_000)

  it.each([
    ['customerA', 'PUT', '/api/pricing/policy'],
    ['finance', 'POST', '/api/pricing/quote'],
    ['quality', 'POST', '/api/pricing/quote'],
    ['operations', 'PUT', '/api/pricing/policy'],
    ['customerA', 'POST', '/api/admin/professionals/approve'],
    ['professionalSuspended', 'GET', '/api/pricing/job'],
    ['professionalApproved', 'POST', '/api/customer/request/submit']
  ] as const)('denies %s using %s %s', async (account, method, path) => {
    const response = await request(method, path, account)
    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toContain('no-store')
  }, 240_000)

  it('returns the same 404 for another customer’s job and an unknown job', async () => {
    const own = await request('GET', `/api/pricing/job?jobId=${jobIds[0]}`, 'customerA')
    expect(own.status).toBe(200)
    expect((await own.json()).job.id).toBe(jobIds[0])
    for (const id of [jobIds[0], randomUUID()]) {
      const denied = await request('GET', `/api/pricing/job?jobId=${id}`, 'customerB')
      expect(denied.status).toBe(404)
      expect(await denied.json()).not.toHaveProperty('job')
    }
    const ownAgain = await request('GET', `/api/pricing/job?jobId=${jobIds[0]}`, 'customerA')
    expect(ownAgain.status).toBe(200)
    expect(ownAgain.headers.get('cache-control')).toContain('no-store')
  }, 900_000)

  it('lets an approved professional read only their assigned job', async () => {
    const assigned = await request('GET', `/api/pricing/job?jobId=${jobIds[0]}`, 'professionalApproved')
    expect(assigned.status).toBe(200)
    const unassigned = await request('GET', `/api/pricing/job?jobId=${jobIds[1]}`, 'professionalApproved')
    expect(unassigned.status).toBe(404)
  }, 600_000)

  it('observes permission removal with an existing authenticated cookie', async () => {
    const cookie = await fixtureCookieHeader(fixtures!.accounts.operations)
    await database!.query('delete from private.admin_profile_permissions where admin_profile_id=$1', [fixtures!.accounts.operations.entityId])
    try {
      const response = await fetch(new URL('/api/pricing/quotes', app!.baseURL), { headers: { Cookie: cookie }, signal: AbortSignal.timeout(180_000) })
      expect(response.status).toBe(403)
    } finally {
      await database!.query('insert into private.admin_profile_permissions (admin_profile_id,permission) values ($1,$2)', [fixtures!.accounts.operations.entityId, 'operations'])
    }
  }, 600_000)
  it('does not authenticate forged SSR cookie contents', async () => {
    const validCookie = await fixtureCookieHeader(fixtures!.accounts.customerA)
    const cookie = validCookie.split('; ').map(entry => `${entry.split('=')[0]}=invalid-session`).join('; ')
    const response = await fetch(new URL('/api/pricing/quotes', app!.baseURL), {
      headers: { Cookie: cookie }, signal: AbortSignal.timeout(180_000)
    })
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toContain('no-store')
  }, 240_000)

  it('refreshes two concurrent tabs from the same real session cookie and preserves access in both', async () => {
    // Only the unsigned client expires_at is aged; the JWT and refresh token
    // still come from real Auth. This exercises refresh contention, not a
    // forged expired JWT or the separate T08 revocation guarantee.
    const cookie = await fixtureCookieHeader(fixtures!.accounts.customerA, { forceRefresh: true })
    const storedCookies = new Map(cookie.split('; ').map(pair => [pair.slice(0, pair.indexOf('=')), decodeURIComponent(pair.slice(pair.indexOf('=') + 1))]))
    const key = [...storedCookies.keys()].find(name => /-auth-token(?:\.\d+)?$/.test(name))?.replace(/\.\d+$/, '')
    expect(key).toBeTruthy()
    const encoded = await combineChunks(key!, name => storedCookies.get(name))
    expect(encoded).toBeTruthy()
    const metadata = JSON.parse(encoded!.startsWith('base64-') ? stringFromBase64URL(encoded!.slice(7)) : encoded!) as { expires_at: number; access_token: string; refresh_token: string }
    expect(metadata.expires_at).toBeLessThan(Math.floor(Date.now() / 1000))
    // Compare booleans so a failed assertion never prints either credential.
    expect(metadata.access_token === fixtures!.accounts.customerA.accessToken).toBe(true)
    expect(metadata.refresh_token === fixtures!.accounts.customerA.refreshToken).toBe(true)
    const url = new URL(`/api/pricing/job?jobId=${jobIds[0]}`, app!.baseURL)
    const responses = await Promise.all([0, 1].map(() => fetch(url, {
      headers: { Cookie: cookie }, signal: AbortSignal.timeout(180_000)
    })))
    const nextCookies: string[] = []
    for (const response of responses) {
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toContain('no-store')
      expect((await response.json()).job.id).toBe(jobIds[0])
      const refreshed = response.headers.getSetCookie()
      expect(refreshed.some(value => /^sb-.+-auth-token(?:\.\d+)?=/.test(value))).toBe(true)
      const jar = new Map(cookie.split('; ').map(pair => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)]))
      for (const setCookie of refreshed) {
        const pair = setCookie.split(';', 1)[0]
        const separator = pair.indexOf('=')
        const name = pair.slice(0, separator), value = pair.slice(separator + 1)
        if (!value || /;\s*max-age=0(?:;|$)/i.test(setCookie)) jar.delete(name)
        else jar.set(name, value)
      }
      const nextCookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
      expect(nextCookie !== cookie).toBe(true)
      nextCookies.push(nextCookie)
    }
    const continued = await Promise.all(nextCookies.map(nextCookie => fetch(url, {
      headers: { Cookie: nextCookie }, signal: AbortSignal.timeout(180_000)
    })))
    for (const response of continued) {
      expect(response.status).toBe(200)
      expect((await response.json()).job.id).toBe(jobIds[0])
      expect(response.headers.get('cache-control')).toContain('no-store')
    }
  }, 600_000)

  it.each([
    ['operations', '/api/admin/professionals/approve'],
    ['professionalApproved', '/api/jobs/final-report']
  ] as const)('does not simulate completion for authorized %s on %s', async (account, path) => {
    const response = await request('POST', path, account, { adminProfileId: 'forged', ownerId: 'forged' })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'feature_unavailable' })
  }, 240_000)

  it('rejects forged ownership fields on the implemented equipment registration endpoint', async () => {
    const response = await request('POST', '/api/equipment/register', 'customerA', { adminProfileId: 'forged', ownerId: 'forged' })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'invalid_input' })
  })

  it('leaves the provider webhook anonymous but rejects an invalid signature', async () => {
    const response = await request('POST', '/api/mercadopago/webhook', undefined, {})
    expect([400, 503]).toContain(response.status)
    expect(response.status).not.toBe(401)
  }, 240_000)
  it.each(['arbitrary-token', '00000000-0000-4000-8000-000000000000'])('does not publish a sample receipt for %s', async token => {
    const response = await request('GET', `/comprobante/${token}`)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const html = await response.text()
    expect(html).not.toContain('Martín Gómez')
    expect(html).toContain('noindex')
  }, 240_000)
})
