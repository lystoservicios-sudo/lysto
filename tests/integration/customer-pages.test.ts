import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { createFixtureAccounts } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'

describe('authenticated customer pages', () => {
  let pending: ReturnType<typeof createFixtureAccounts>
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let app: Awaited<ReturnType<typeof startTestApp>>
  let database: Client
  const addressId = randomUUID(),
    requestId = randomUUID(),
    jobId = randomUUID()

  beforeAll(async () => {
    pending = createFixtureAccounts()
    fixture = await pending
    const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
    database = new Client({
      connectionString: target.databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 20000
    })
    await database.connect()
    await database.query(
      'insert into public.customer_addresses(id,customer_id,street,number,city,province) values($1,$2,$3,$4,$5,$6)',
      [addressId, fixture.accounts.customerA.entityId, 'Calle real', '42', 'CABA', 'CABA']
    )
    await database.query(
      `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,address_id,preferred_date,preferred_time_window) select $1,$2,c.id,i.id,'assigned',$3,current_date + 1,'09:00 - 11:00' from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.slug='aire_acondicionado' and i.slug='mantenimiento'`,
      [requestId, fixture.accounts.customerA.entityId, addressId]
    )
    await database.query(
      "insert into public.jobs(id,request_id,customer_id,status,scheduled_date,scheduled_time_window) values($1,$2,$3,'confirmed',current_date + 1,'09:00 - 11:00')",
      [jobId, requestId, fixture.accounts.customerA.entityId]
    )
    app = await startTestApp()
  }, 300000)

  afterAll(async () => {
    try {
      await app?.stop()
    } finally {
      try {
        if (database) {
          await database.query('delete from public.jobs where id=$1', [jobId])
          await database.query('delete from public.service_requests where id=$1', [requestId])
          await database.query('delete from public.customer_addresses where id=$1', [addressId])
        }
      } finally {
        await database?.end()
        await pending?.cleanup()
      }
    }
  }, 180000)

  async function page(path: string, actor: 'customerA' | 'customerB') {
    return fetch(new URL(path, app.baseURL), {
      redirect: 'manual',
      headers: { Cookie: await fixtureCookieHeader(fixture.accounts[actor]) },
      signal: AbortSignal.timeout(90000)
    })
  }

  it('renders persisted requests and jobs without demonstration content', async () => {
    for (const path of ['/app/solicitudes', '/app/trabajos']) {
      const response = await page(path, 'customerA')
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain(path.includes('solicitudes') ? requestId.slice(0, 8) : jobId)
      expect(html).not.toMatch(/Demostraci[oó]n|customerDemoFixtures/)
    }
  })

  it('shows an honest empty state for a customer without history', async () => {
    const response = await page('/app/trabajos', 'customerB')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Todavía no tenés trabajos')
  })

  it('returns absence for another customer review URL', async () => {
    const response = await page(`/app/trabajos/${jobId}/review`, 'customerB')
    expect([200, 404]).toContain(response.status)
    const html = await response.text()
    expect(html).not.toContain('Calificar servicio')
  })
})
