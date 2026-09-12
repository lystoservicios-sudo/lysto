import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { createFixtureAccounts } from './fixtures'

type QueueRow = { id: string; created_at: string; entity_type: string }
type QueueResult = { items: QueueRow[]; total: number }

describe('administrative operations queue', () => {
  let pending: ReturnType<typeof createFixtureAccounts> | undefined
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let database: Client
  const requestIds: string[] = []

  beforeAll(async () => {
    pending = createFixtureAccounts()
    fixture = await pending
    const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
    database = new Client({ connectionString: target.databaseUrl, connectionTimeoutMillis: 5_000 })
    await database.connect()
    const customerId = fixture.accounts.customerA.entityId
    for (let index = 0; index < 105; index++) requestIds.push(randomUUID())
    await database.query(
      `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,urgency_level,created_at)
       select value::uuid,$1,c.id,i.id,'pending_assignment',case when ordinality % 9=0 then 'priority'::public.urgency_level else 'flexible'::public.urgency_level end,'2026-09-12T09:00:00Z'::timestamptz
       from unnest($2::text[]) with ordinality as ids(value,ordinality)
       cross join lateral (select id from public.service_categories where active order by id limit 1) c
       cross join lateral (select id from public.service_issue_types where category_id=c.id and active order by id limit 1) i`,
      [customerId, requestIds]
    )
  }, 180_000)

  afterAll(async () => {
    try {
      if (database)
        await database.query('delete from public.service_requests where id=any($1::uuid[])', [
          requestIds
        ])
    } finally {
      await database?.end()
      await pending?.cleanup()
    }
  }, 180_000)

  it('paginates more than 100 records with stable identifiers and operational fields', async () => {
    const client = fixture.accounts.operations.client
    const first = await client.rpc('list_operator_queue', {
      p_limit: 100,
      p_cursor_at: null,
      p_cursor_id: null
    })
    expect(first.error).toBeNull()
    const firstPage = first.data as QueueResult
    expect(firstPage.total).toBeGreaterThanOrEqual(105)
    expect(firstPage.items).toHaveLength(101)
    const boundary = firstPage.items[99]
    const second = await client.rpc('list_operator_queue', {
      p_limit: 100,
      p_cursor_at: boundary.created_at,
      p_cursor_id: boundary.id
    })
    expect(second.error).toBeNull()
    const all = [...firstPage.items.slice(0, 100), ...((second.data as QueueResult).items ?? [])]
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length)
    expect(requestIds.every((id) => all.some((item) => item.id === id))).toBe(true)
    expect(
      all
        .filter((item) => requestIds.includes(item.id))
        .every((item) => item.entity_type === 'request')
    ).toBe(true)
  })

  it('denies the operations queue to finance-only administrators', async () => {
    const result = await fixture.accounts.finance.client.rpc('list_operator_queue', {
      p_limit: 25,
      p_cursor_at: null,
      p_cursor_id: null
    })
    expect(result.error?.code).toBe('42501')
  })
})
