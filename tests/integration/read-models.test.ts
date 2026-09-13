import { randomUUID } from 'node:crypto'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '@/lib/supabase/database.types'
import { createCustomerQueries } from '@/lib/data-access/customer-queries'
import { createProfessionalQueries } from '@/lib/data-access/professional-queries'
import { createAdminQueries } from '@/lib/data-access/admin-queries'
import { createFixtureAccounts, type AccountName } from './fixtures'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'

describe('session-bound read models', () => {
  let pending: ReturnType<typeof createFixtureAccounts> | undefined
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let database: Client
  const requestIds: string[] = [],
    jobIds: string[] = [],
    equipmentIds: string[] = [],
    addressIds: string[] = []
  const client = (name: AccountName) => fixture.accounts[name].client as SupabaseClient<Database>
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
    for (const [account, total] of [
      ['customerA', 137],
      ['customerB', 7]
    ] as const) {
      const customer = fixture.accounts[account].entityId,
        address = randomUUID()
      addressIds.push(address)
      await database.query(
        'insert into public.customer_addresses(id,customer_id,street,number,city,province) values($1,$2,$3,$4,$5,$6)',
        [address, customer, 'Synthetic', '1', 'CABA', 'CABA']
      )
      for (let i = 0; i < total; i++) {
        const equipment = randomUUID(),
          request = randomUUID(),
          job = randomUUID()
        equipmentIds.push(equipment)
        requestIds.push(request)
        jobIds.push(job)
        await database.query(
          "insert into public.customer_equipment(id,customer_id,nickname,serial_number,notes,created_at,address_id,category_id) values($1,$2,$3,$4,$5,$6,$7,(select id from public.service_categories where slug='aire_acondicionado'))",
          [
            equipment,
            customer,
            'Aire ' + i,
            'PRIVATE-SERIAL',
            'PRIVATE-NOTES',
            '2026-09-11T10:00:00.123456Z',
            address
          ]
        )
        await database.query(
          `insert into public.service_requests(id,customer_id,equipment_id,category_id,issue_type_id,status,created_at,address_id) select $1,$2,$3,c.id,i.id,$4,$5,$6 from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.slug='aire_acondicionado' and i.slug='mantenimiento'`,
          [
            request,
            customer,
            equipment,
            i % 2 ? 'draft' : 'pending_assignment',
            '2026-09-11T10:00:00.123456Z',
            address
          ]
        )
        await database.query(
          'insert into public.jobs(id,request_id,customer_id,professional_id,status,created_at) values($1,$2,$3,$4,$5,$6)',
          [
            job,
            request,
            customer,
            fixture.accounts[
              account === 'customerA' ? 'professionalApproved' : 'professionalSuspended'
            ].entityId,
            'confirmed',
            '2026-09-11T10:00:00.123456Z'
          ]
        )
        await database.query(
          'insert into public.payments(job_id,request_id,customer_id,professional_id,amount,marketplace_fee,professional_amount,provider_payment_id,checkout_idempotency_key,created_at) values($1,$2,$3,$4,1000,180,820,$5,$6,$7)',
          [
            job,
            request,
            customer,
            fixture.accounts[
              account === 'customerA' ? 'professionalApproved' : 'professionalSuspended'
            ].entityId,
            'PRIVATE-PROVIDER-' + randomUUID(),
            'PRIVATE-CHECKOUT-' + randomUUID(),
            '2026-09-11T10:00:00.123456Z'
          ]
        )
        await database.query(
          'insert into public.warranty_claims(job_id,customer_id,description,created_at) values($1,$2,$3,$4)',
          [job, customer, 'Consulta propia', '2026-09-11T10:00:00.123456Z']
        )
      }
    }
  }, 180000)
  afterAll(async () => {
    try {
      if (database) {
        await database.query('delete from public.warranty_claims where job_id=any($1::uuid[])', [
          jobIds
        ])
        await database.query('delete from public.payments where request_id=any($1::uuid[])', [
          requestIds
        ])
        await database.query('delete from public.service_requests where id=any($1::uuid[])', [
          requestIds
        ])
        await database.query('delete from public.customer_equipment where id=any($1::uuid[])', [
          equipmentIds
        ])
        await database.query('delete from public.customer_addresses where id=any($1::uuid[])', [
          addressIds
        ])
      }
    } finally {
      try {
        await database?.end()
      } finally {
        await pending?.cleanup()
      }
    }
  }, 180000)
  it.each(['requests', 'jobs', 'payments', 'equipment', 'claims'] as const)(
    'paginates all own %s with stable ties, exact total and no foreign rows',
    async (resource) => {
      const repository = createCustomerQueries(client('customerA'))
      let cursor: string | undefined
      const ids: string[] = []
      do {
        const page = await repository.list(resource, { pageSize: 50, cursor })
        expect(page.total).toBe(137)
        expect(page.items.length).toBeLessThanOrEqual(50)
        ids.push(...page.items.map((item) => item.id))
        cursor = page.nextCursor ?? undefined
        expect(ids.length).toBeLessThanOrEqual(137)
      } while (cursor)
      expect(ids).toHaveLength(137)
      expect(new Set(ids).size).toBe(137)
      expect(ids).toEqual([...ids].sort().reverse())
    }
  )
  it('uses the same status filter for totals, pages and cursor scope', async () => {
    const repository = createCustomerQueries(client('customerA'))
    const page = await repository.list('requests', { status: 'draft', pageSize: 25 })
    expect(page.total).toBe(68)
    expect(page.items.every((item) => item.status === 'draft')).toBe(true)
    await expect(
      repository.list('requests', { status: 'pending_assignment', cursor: page.nextCursor! })
    ).rejects.toThrow()
    await expect(repository.list('requests', { status: 'draft),id.neq.any' })).rejects.toThrow()
  })
  it('isolates details and refuses cursors from another identity', async () => {
    const a = createCustomerQueries(client('customerA')),
      b = createCustomerQueries(client('customerB'))
    const page = await a.list('requests')
    expect(await b.detail('requests', page.items[0].id)).toBeNull()
    await expect(b.list('requests', { cursor: page.nextCursor! })).rejects.toThrow()
    expect((await b.list('requests')).total).toBe(7)
  })
  it('projects different payment DTOs without provider or checkout secrets', async () => {
    const customer = await createCustomerQueries(client('customerA')).list('payments')
    const professional = await createProfessionalQueries(client('professionalApproved')).list(
      'payments'
    )
    const finance = await createAdminQueries(client('finance')).list('payments')
    expect(customer.items[0]).toMatchObject({ amount: 1000, currency: 'ARS' })
    expect(professional.items[0]).toMatchObject({ amountToReceive: 820 })
    expect(finance.items[0]).toMatchObject({
      amount: 1000,
      marketplaceFee: 180,
      professionalAmount: 820
    })
    expect(JSON.stringify(customer)).not.toContain('PRIVATE-')
    expect(JSON.stringify(professional)).not.toContain('PRIVATE-')
    expect(JSON.stringify(finance)).not.toContain('PRIVATE-CHECKOUT')
  })
  it('keeps each administrative scope separate and fails explicitly when unsupported', async () => {
    expect(
      (await createAdminQueries(client('operations')).list('requests', { pageSize: 100 })).total
    ).toBe(144)
    expect((await createAdminQueries(client('quality')).list('claims')).total).toBe(144)
    await expect(createAdminQueries(client('operations')).list('payments')).rejects.toThrow()
    await expect(createAdminQueries(client('finance')).list('claims')).rejects.toThrow()
    await expect(createCustomerQueries(client('customerA')).list('professionals')).rejects.toThrow()
  })
  it('restricts professional rows, drops unrelated private profile fields and rechecks suspension', async () => {
    const repository = createProfessionalQueries(client('professionalApproved'))
    expect((await repository.list('jobs')).total).toBe(137)
    const profile = await repository.list('professionals')
    expect(profile.total).toBe(1)
    expect(profile.items[0].id).toBe(fixture.accounts.professionalApproved.entityId)
    expect(JSON.stringify(profile)).not.toMatch(/dni|cuil|birthdate|internalScore|internal_score/)
    await database.query("update public.professional_profiles set status='suspended' where id=$1", [
      fixture.accounts.professionalApproved.entityId
    ])
    try {
      await expect(repository.list('jobs')).rejects.toThrow()
    } finally {
      await database.query(
        "update public.professional_profiles set status='approved' where id=$1",
        [fixture.accounts.professionalApproved.entityId]
      )
    }
  })
  it('computes authorized metrics independently of a page size', async () => {
    const result = await createCustomerQueries(client('customerA')).metrics()
    expect(result).toMatchObject({
      requests: 137,
      jobs: 137,
      payments: 137,
      equipment: 137,
      claims: 137
    })
    expect((await createProfessionalQueries(client('professionalApproved')).metrics()).jobs).toBe(
      137
    )
  })
  it('returns an empty page only when the authorized query is actually empty', async () => {
    const page = await createCustomerQueries(client('customerA')).list('requests', {
      status: 'cancelled'
    })
    expect(page).toMatchObject({ items: [], total: 0, nextCursor: null })
    await expect(createCustomerQueries(client('finance')).list('requests')).rejects.toThrow()
  })
  it('captures actual RLS query plans against a larger disposable dataset', async () => {
    await database.query('begin')
    try {
      const a = fixture.accounts.customerA,
        b = fixture.accounts.customerB
      await database.query(
        "insert into public.customer_equipment(customer_id,nickname,created_at) select c.id,'EXPLAIN-only',now()-s.n*interval '1 second' from public.customer_profiles c cross join generate_series(1,5000) s(n) where c.id=any($1::uuid[])",
        [[a.entityId, b.entityId]]
      )
      await database.query(
        "insert into public.service_requests(customer_id,category_id,issue_type_id,status,created_at) select c.id,i.category_id,i.id,'draft',now()-s.n*interval '1 second' from public.customer_profiles c cross join generate_series(1,5000) s(n) cross join public.service_issue_types i where c.id=any($1::uuid[]) and i.slug='mantenimiento'",
        [[a.entityId, b.entityId]]
      )
      await database.query(
        "insert into public.jobs(request_id,customer_id,professional_id,status,created_at) select r.id,r.customer_id,$1,'confirmed',r.created_at from public.service_requests r where r.customer_id=any($2::uuid[]) and not exists(select 1 from public.jobs j where j.request_id=r.id)",
        [fixture.accounts.professionalApproved.entityId, [a.entityId, b.entityId]]
      )
      await database.query(
        'analyze public.customer_equipment; analyze public.service_requests; analyze public.jobs'
      )
      await database.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({
          sub: a.authId,
          role: 'authenticated',
          session_id: JSON.parse(Buffer.from(a.accessToken.split('.')[1], 'base64url').toString()).session_id,
          aal: 'aal1',
          app_metadata: { app_role: 'customer' }
        })
      ])
      await database.query('set local role authenticated')
      const plans: Record<string, unknown> = {}
      for (const table of ['customer_equipment', 'service_requests', 'jobs']) {
        const result = await database.query(
          `explain (analyze,buffers,format json) select id,created_at from public.${table} where customer_id=$1 order by created_at desc,id desc limit 51`,
          [a.entityId]
        )
        plans[table] = result.rows[0]['QUERY PLAN']
        expect(result.rows[0]['QUERY PLAN'][0].Plan['Actual Rows']).toBe(51)
      }
      mkdirSync('output/production-readiness', { recursive: true })
      const indexes = await database.query(
        "select indexname from pg_indexes where schemaname='public' and indexname like 'idx_read_%' order by indexname"
      )
      writeFileSync(
        `output/production-readiness/t12-explain-${indexes.rowCount ? 'indexed' : 'baseline'}.json`,
        JSON.stringify(
          {
            project: 'lysto_production_check',
            rowsPerOwner: 5137,
            role: 'authenticated/customer',
            indexes: indexes.rows,
            plans
          },
          null,
          2
        ) + '\n'
      )
      copyFileSync(
        `output/production-readiness/t12-explain-${indexes.rowCount ? 'indexed' : 'baseline'}.json`,
        `output/production-readiness/t12-explain-${fixture.runId}.json`
      )
      expect(Object.keys(plans)).toHaveLength(3)
    } finally {
      await database.query('rollback')
    }
  }, 60000)
})
