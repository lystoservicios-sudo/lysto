import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { createFixtureAccounts } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'

describe('authenticated professional pages', () => {
  let pending: ReturnType<typeof createFixtureAccounts>
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let app: Awaited<ReturnType<typeof startTestApp>>
  let database: Client
  const addressId = randomUUID(),
    equipmentId = randomUUID(),
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
    const customer = fixture.accounts.customerA.entityId
    await database.query(
      'insert into public.customer_addresses(id,customer_id,street,number,city,province) values($1,$2,$3,$4,$5,$6)',
      [addressId, customer, 'Profesional', '88', 'CABA', 'CABA']
    )
    await database.query(
      "insert into public.customer_equipment(id,customer_id,address_id,category_id,nickname,equipment_type) select $1,$2,$3,id,'Equipo asignado','split' from public.service_categories where slug='aire_acondicionado'",
      [equipmentId, customer, addressId]
    )
    await database.query(
      `insert into public.service_requests(id,customer_id,equipment_id,category_id,issue_type_id,status,address_id) select $1,$2,$3,c.id,i.id,'assigned',$4 from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.slug='aire_acondicionado' and i.slug='mantenimiento'`,
      [requestId, customer, equipmentId, addressId]
    )
    await database.query(
      "insert into public.jobs(id,request_id,customer_id,professional_id,status,scheduled_date,scheduled_time_window) values($1,$2,$3,$4,'confirmed',current_date + 1,'10:00 - 12:00')",
      [jobId, requestId, customer, fixture.accounts.professionalApproved.entityId]
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
          await database.query('delete from public.customer_equipment where id=$1', [equipmentId])
          await database.query('delete from public.customer_addresses where id=$1', [addressId])
        }
      } finally {
        await database?.end()
        await pending?.cleanup()
      }
    }
  }, 180000)

  async function page(path: string, actor: 'professionalApproved' | 'professionalSuspended') {
    return fetch(new URL(path, app.baseURL), {
      redirect: 'manual',
      headers: { Cookie: await fixtureCookieHeader(fixture.accounts[actor]) },
      signal: AbortSignal.timeout(90000)
    })
  }

  it('shows only the approved professional assigned work', async () => {
    const response = await page('/pro/trabajos', 'professionalApproved')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain(jobId)
    expect(html).not.toMatch(/Vista de demostraci[oó]n|perfil demostrativo/i)
  })

  it('allows equipment history only through an assigned job', async () => {
    const response = await page(`/pro/equipos/${equipmentId}`, 'professionalApproved')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Equipo asignado')
  })

  it('shows the empty assigned history after removing the only owned job from view', async () => {
    await database.query('update public.jobs set professional_id=$1 where id=$2', [
      fixture.accounts.professionalSuspended.entityId,
      jobId
    ])
    try {
      const response = await page('/pro/trabajos', 'professionalApproved')
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('No hay trabajos en este estado')
    } finally {
      await database.query('update public.jobs set professional_id=$1 where id=$2', [
        fixture.accounts.professionalApproved.entityId,
        jobId
      ])
    }
  })

  it('does not open the professional workspace for a suspended profile', async () => {
    const response = await page('/pro/dashboard', 'professionalSuspended')
    expect(response.status).toBe(404)
  })
})
