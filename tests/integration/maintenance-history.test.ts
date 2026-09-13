import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createFixtureAccounts } from './fixtures'

describe('maintenance history and reminders', () => {
  const setup = createFixtureAccounts(),
    db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  let fixture: Awaited<typeof setup>
  const equipmentId = randomUUID(),
    requestId = randomUUID(),
    jobId = randomUUID(),
    recordId = randomUUID()
  let planId = '',
    version = 1,
    addressId = '',
    createdRequest: string | null = null
  beforeAll(async () => {
    fixture = await setup
    await db.connect()
    const cfg = (
      await db.query(
        `select c.id category,i.id issue from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
      )
    ).rows[0]
    addressId = (
      await db.query(`select id from public.customer_addresses where customer_id=$1 limit 1`, [
        fixture.accounts.customerA.entityId
      ])
    ).rows[0].id
    await db.query(
      `insert into public.customer_equipment(id,customer_id,address_id,category_id,nickname,equipment_type) values($1,$2,$3,$4,'Equipo mantenido','split')`,
      [equipmentId, fixture.accounts.customerA.entityId, addressId, cfg.category]
    )
    await db.query(
      `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,address_id,equipment_id) values($1,$2,$3,$4,'assigned',$5,$6)`,
      [
        requestId,
        fixture.accounts.customerA.entityId,
        cfg.category,
        cfg.issue,
        addressId,
        equipmentId
      ]
    )
    await db.query(
      `insert into public.jobs(id,request_id,customer_id,professional_id,status,completed_at) values($1,$2,$3,$4,'completed',now())`,
      [
        jobId,
        requestId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    await db.query(
      `insert into public.equipment_service_records(id,equipment_id,job_id,professional_id,real_diagnosis,work_done,next_maintenance_option,next_maintenance_date) values($1,$2,$3,$4,'Filtros saturados','Limpieza y prueba completa','filters_60_days',current_date+1)`,
      [recordId, equipmentId, jobId, fixture.accounts.professionalApproved.entityId]
    )
    const p = (
      await db.query(
        `select id,version,due_date from public.maintenance_plans where source_service_record_id=$1`,
        [recordId]
      )
    ).rows[0]
    planId = p.id
    version = p.version
  })
  afterAll(async () => {
    try {
      await db.query(
        `delete from private.outbox_events where aggregate_id in(select id from public.complaints where job_id=$1)`,
        [jobId]
      )
      await db.query(`delete from public.complaints where job_id=$1`, [jobId])
      await db.query(`delete from public.maintenance_plans where id=$1`, [planId])
      if (createdRequest)
        await db.query(`delete from public.service_requests where id=$1`, [createdRequest])
      await db.query(`delete from public.equipment_service_records where id=$1`, [recordId])
      await db.query(`delete from public.jobs where id=$1`, [jobId])
      await db.query(`delete from public.service_requests where id=$1`, [requestId])
      await db.query(`delete from public.customer_equipment where id=$1`, [equipmentId])
    } finally {
      await db.end()
      await setup.cleanup()
    }
  })
  it('derives the date from the persisted recommendation and exposes append-only history', async () => {
    const list = await fixture.accounts.customerA.client.rpc('list_customer_maintenance')
    expect(list.error).toBeNull()
    const p = list.data.find((x: { id: string }) => x.id === planId)
    expect(p.history).toHaveLength(1)
    expect(p.history[0]).toMatchObject({
      jobId,
      diagnosis: 'Filtros saturados',
      workDone: 'Limpieza y prueba completa'
    })
  })
  it('moves one recommendation and keeps one active reminder', async () => {
    const due = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      moved = await fixture.accounts.customerA.client.rpc('manage_maintenance_plan', {
        p_plan_id: planId,
        p_action: 'defer',
        p_expected_version: version,
        p_due_date: due,
        p_address_id: null
      })
    expect(moved.error).toBeNull()
    version = moved.data.version
    const count = (
      await db.query(
        `select count(*)::int n from private.maintenance_reminders where plan_id=$1 and status='pending'`,
        [planId]
      )
    ).rows[0].n
    expect(count).toBe(1)
  })
  it('does not promote maintenance over an open warranty case', async () => {
    await db.query(
      `insert into public.complaints(job_id,customer_id,professional_id,source,category,severity,description,opened_by) values($1,$2,$3,'warranty','warranty','high','Garantía pendiente que debe resolverse primero.',$4)`,
      [
        jobId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId,
        fixture.accounts.customerA.profileId
      ]
    )
    const listed = await fixture.accounts.customerA.client.rpc('list_customer_maintenance')
    const p = listed.data.find((x: { id: string }) => x.id === planId)
    expect(p.status).toBe('suppressed_by_case')
    expect(
      (
        await db.query(
          `select count(*)::int n from private.maintenance_reminders where plan_id=$1 and status='pending'`,
          [planId]
        )
      ).rows[0].n
    ).toBe(0)
    version = p.version
  })
  it('starts only a draft after the quality case closes and current address is confirmed', async () => {
    await db.query(
      `update public.complaints set status='resolved',resolved_at=now() where job_id=$1`,
      [jobId]
    )
    const p = (await fixture.accounts.customerA.client.rpc('list_customer_maintenance')).data.find(
      (x: { id: string }) => x.id === planId
    )
    const result = await fixture.accounts.customerA.client.rpc('manage_maintenance_plan', {
      p_plan_id: planId,
      p_action: 'request_service',
      p_expected_version: p.version,
      p_due_date: null,
      p_address_id: addressId
    })
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      status: 'requested',
      reservationCreated: false,
      paymentCreated: false
    })
    createdRequest = result.data.requestId
    expect(
      (
        await db.query(
          `select status,equipment_id,address_id from public.service_requests where id=$1`,
          [createdRequest]
        )
      ).rows[0]
    ).toMatchObject({ status: 'draft', equipment_id: equipmentId, address_id: addressId })
  })
})
