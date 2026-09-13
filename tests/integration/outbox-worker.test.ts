import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { createFixtureAccounts } from './fixtures'

describe('durable notification delivery boundary', () => {
  const setup = createFixtureAccounts()
  let fixture: Awaited<typeof setup>
  const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const service = createClient(
    process.env.LYSTO_TEST_SUPABASE_URL!,
    process.env.LYSTO_TEST_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const ids: string[] = []
  const businessIds: string[] = []
  beforeAll(async () => {
    fixture = await setup
    await db.connect()
  })
  afterAll(async () => {
    try {
      if (ids.length || businessIds.length)
        await db.query(
          'delete from private.outbox_events where id=any($1::uuid[]) or aggregate_id=any($2::uuid[])',
          [ids, businessIds]
        )
      if (businessIds.length) {
        await db.query('delete from public.complaints where id=any($1::uuid[])', [businessIds])
        await db.query('delete from public.payments where id=any($1::uuid[])', [businessIds])
        await db.query('delete from public.jobs where id=any($1::uuid[])', [businessIds])
        await db.query('delete from public.service_requests where id=any($1::uuid[])', [
          businessIds
        ])
      }
    } finally {
      await db.end()
      await setup.cleanup()
    }
  })
  async function enqueue() {
    const id = randomUUID()
    ids.push(id)
    await db.query(
      `insert into private.outbox_events(id,event_type,aggregate_type,aggregate_id,channel,recipient_profile_id,recipient_key,dedupe_key,payload)
      values($1::uuid,'professional.approved','professional',$2::uuid,'in_app',$3::uuid,$3::text,$1::text,'{}')`,
      [
        id,
        fixture.accounts.professionalApproved.entityId,
        fixture.accounts.professionalApproved.profileId
      ]
    )
    return id
  }
  it('resolves the live recipient and context only for the current claim', async () => {
    const id = await enqueue()
    const { rows } = await db.query('select * from public.claim_outbox_events($1,100,120)', [
      fixture.runId
    ])
    const event = rows.find((row) => row.id === id)
    expect(event).toBeTruthy()
    const { data, error } = await service.rpc('resolve_outbox_delivery', {
      p_event_id: id,
      p_claim_token: event.claim_token
    })
    expect(error).toBeNull()
    expect(data.context).toEqual({
      eventType: 'professional.approved',
      aggregateId: fixture.accounts.professionalApproved.entityId,
      audience: 'professional'
    })
    expect(data.recipientEmail).toBe(fixture.accounts.professionalApproved.email)
    expect(
      (
        await service.rpc('resolve_outbox_delivery', {
          p_event_id: id,
          p_claim_token: randomUUID()
        })
      ).error?.code
    ).toBe('40001')
  })
  it('does not expose delivery payload or worker RPCs to authenticated accounts', async () => {
    const { error } = await fixture.accounts.customerA.client.rpc('resolve_outbox_delivery', {
      p_event_id: ids[0],
      p_claim_token: randomUUID()
    })
    expect(error?.code).toBe('42501')
  })
  it('keeps privileged implementations outside the exposed public schema', async () => {
    const { rows } =
      await db.query(`select p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('resolve_outbox_delivery','seal_outbox_delivery','finish_in_app_delivery','finish_email_delivery','stop_outbox_delivery')`)
    expect(rows).toHaveLength(5)
    expect(rows.every((row) => row.prosecdef === false)).toBe(true)
    const grants = await db.query(`select grantee from information_schema.role_table_grants
      where table_schema='private' and table_name='outbox_delivery_snapshots'
        and grantee in ('PUBLIC','anon','authenticated','service_role')`)
    expect(grants.rows).toEqual([])
  })
  it('persists customer, assignment, payment and support events in their business transactions', async () => {
    const requestId = randomUUID(),
      jobId = randomUUID(),
      paymentId = randomUUID(),
      complaintId = randomUUID()
    businessIds.push(requestId, jobId, paymentId, complaintId)
    const config = await db.query(
      `select c.id category_id,i.id issue_id from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
    )
    await db.query(
      `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status) values($1,$2,$3,$4,'pending_assignment')`,
      [
        requestId,
        fixture.accounts.customerA.entityId,
        config.rows[0].category_id,
        config.rows[0].issue_id
      ]
    )
    await db.query(
      `insert into public.jobs(id,request_id,customer_id,status) values($1,$2,$3,'pending_assignment')`,
      [jobId, requestId, fixture.accounts.customerA.entityId]
    )
    await db.query(
      `update public.jobs set professional_id=$2,status='pending_professional_acceptance' where id=$1`,
      [jobId, fixture.accounts.professionalApproved.entityId]
    )
    await db.query(
      `insert into public.payments(id,job_id,request_id,customer_id,professional_id,amount,marketplace_fee,professional_amount,status) values($1,$2,$3,$4,$5,100,18,82,'pending')`,
      [
        paymentId,
        jobId,
        requestId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    await db.query(`update public.payments set status='approved' where id=$1`, [paymentId])
    await db.query(
      `insert into public.complaints(id,job_id,customer_id,professional_id,description) values($1,$2,$3,$4,'Fixture support case')`,
      [
        complaintId,
        jobId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    const events = await db.query(
      `select event_type,aggregate_id,channel from private.outbox_events where aggregate_id=any($1::uuid[])`,
      [businessIds]
    )
    expect(events.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: 'request.created',
          aggregate_id: requestId,
          channel: 'in_app'
        }),
        expect.objectContaining({
          event_type: 'job.assigned',
          aggregate_id: jobId,
          channel: 'email'
        }),
        expect.objectContaining({
          event_type: 'payment.approved',
          aggregate_id: paymentId,
          channel: 'email'
        }),
        expect.objectContaining({
          event_type: 'support.opened',
          aggregate_id: complaintId,
          channel: 'in_app'
        })
      ])
    )
  })
})
