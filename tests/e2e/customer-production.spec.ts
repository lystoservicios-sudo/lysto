import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

import { test, expect, loginAs } from './fixtures/production'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'

test('customer registration shows the approved legal consent without granting a professional account', async ({ page }) => {
  await page.goto('/registro')
  await expect(page.getByRole('heading', { name: 'Tu hogar, en buenas manos.' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Leí y acepto los términos/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /términos \(2026-09-21\)/ })).toHaveAttribute('href', 'https://lystohogar.com/terminos')
  await expect(page.getByRole('button', { name: 'Crear mi cuenta' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Crear cuenta para postularme/ })).toHaveCount(0)
})

test('same-origin confirmation form reaches token validation', async ({ page }) => {
  await page.goto(`/auth/confirm?token_hash=${'a'.repeat(64)}`)
  await page.getByRole('button', { name: 'Confirmar correo' }).click()
  await expect(page.getByText('El enlace venció o ya fue utilizado.')).toBeVisible()
  await expect(page.getByText('No pudimos validar el origen de la solicitud.')).toHaveCount(0)
})

test('customer reloads the live dashboard and empty request history', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  await expect(page.getByRole('heading', { name: '¿Qué necesitás?' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'No enfría', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'No enfría', exact: true })).toHaveAttribute('href', '/app/solicitar/aire-acondicionado?problema=no_enfria')
  // The real fixture already owns a saved address, but no equipment.
  await expect(page.getByRole('heading', { name: 'Agregá tu primer equipo', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Agregar equipo', exact: true })).toHaveAttribute('href', '/app/equipos')
  await page.goto('/app/solicitudes')
  await expect(page.getByRole('heading', { name: 'Mis solicitudes' })).toBeVisible()
  await expect(page.getByText('Todavía no tenés solicitudes')).toBeVisible()
})

test('a customer cannot load another customer identifier', async ({ page, accounts }) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  await page.goto(`/app/equipos/${accounts.accounts.customerB.entityId}`)
  await expect(page.getByRole('heading', { name: 'No encontramos ese equipo' })).toBeVisible()
})

test('customer sees a paid confirmed visit, reprogramming and one persisted review', async ({
  page,
  accounts
}) => {
  // This complete two-customer journey makes several live staging round trips.
  test.setTimeout(60_000)
  const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
  const db = new Client({ connectionString: target.databaseUrl, connectionTimeoutMillis: 5000, query_timeout: 10000 })
  const addressId = randomUUID(),
    requestId = randomUUID(),
    jobId = randomUUID(),
    firstScheduleId = randomUUID(),
    secondScheduleId = randomUUID(),
    decisionId = randomUUID(),
    checkoutId = randomUUID()
  await db.connect()
  try {
    const config = (
      await db.query(
        `select c.id category_id,i.id issue_id from public.service_categories c
         join public.service_issue_types i on i.category_id=c.id
         where c.active and i.active order by c.id,i.sort_order limit 1`
      )
    ).rows[0]
    await db.query(
      `insert into public.customer_addresses(id,customer_id,street,number,city,province)
       values($1,$2,'Calle Visita','2040','Buenos Aires','Buenos Aires')`,
      [addressId, accounts.accounts.customerA.entityId]
    )
    await db.query(
      `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,address_id)
       values($1,$2,$3,$4,'assigned',$5)`,
      [
        requestId,
        accounts.accounts.customerA.entityId,
        config.category_id,
        config.issue_id,
        addressId
      ]
    )
    await db.query(
      `insert into public.jobs(id,request_id,customer_id,professional_id,status,schedule_version)
       values($1,$2,$3,$4,'confirmed',1)`,
      [
        jobId,
        requestId,
        accounts.accounts.customerA.entityId,
        accounts.accounts.professionalApproved.entityId
      ]
    )
    await db.query(
      `insert into public.job_schedule_reservations(id,job_id,professional_id,version,starts_at,ends_at,local_visit_date,timezone,duration_minutes,travel_buffer_minutes,state,created_by)
       values($1,$2,$3,1,'2030-09-18 13:00:00+00','2030-09-18 15:00:00+00','2030-09-18','America/Argentina/Buenos_Aires',120,30,'confirmed',$4)`,
      [
        firstScheduleId,
        jobId,
        accounts.accounts.professionalApproved.entityId,
        accounts.accounts.professionalApproved.profileId
      ]
    )

    await loginAs(page, accounts.accounts.customerA, 'customerA')
    await page.goto(`/app/trabajos/${jobId}#agenda`)
    // Professional acceptance and a reservation do not establish payment.
    await expect(page.getByRole('heading', { name: 'Ya podés pagar', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Visita confirmada', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Solicitar reprogramación' })).toHaveCount(0)
    await expect(page.getByText('Pago aprobado', { exact: true })).toHaveCount(0)

    // Only our exact synthetic checkout is marked approved. No provider is called.
    await db.query(
      `insert into public.marketplace_checkouts(id,job_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode,status)
       values($1,$2,$3,$4,'e2e-synthetic-seller',100,18,false,'approved')`,
      [checkoutId, jobId, accounts.accounts.customerA.entityId, accounts.accounts.professionalApproved.entityId]
    )
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Visita confirmada', exact: true })).toBeVisible()
    await expect(page.locator('#agenda').getByText(/18 de septiembre/)).toBeVisible()
    await expect(page.locator('#agenda').getByText('10:00 a 12:00', { exact: true })).toBeVisible()
    await expect(page.getByText('Pago aprobado', { exact: true })).toBeVisible()
    await expect(page.getByText('Calle Visita 2040, Buenos Aires')).toBeVisible()
    const navigation = page.getByRole('navigation', { name: 'Navegación principal del cliente' })
    await expect(navigation).toBeVisible()
    await expect(page.getByRole('link', { name: 'Contactar a soporte de Lysto' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Garantías y reclamos', exact: true })).toHaveCount(0)
    await page.goto(`/app/trabajos/${jobId}#reprogramacion`)
    await expect(page.getByRole('heading', { name: 'Solicitar otra fecha', exact: true })).toBeVisible()
    await expect(page.getByLabel('Nueva fecha y hora', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Motivo de la reprogramación', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar solicitud', exact: true })).toBeDisabled()
    await expect(navigation).toHaveCount(0)
    await page.getByRole('button', { name: 'Volver al servicio', exact: true }).click()
    await expect(navigation).toBeVisible()
    await expect(page.locator('#agenda').getByText(/18 de septiembre/)).toBeVisible()
    // Closing the focused view does not rewrite its deep-link hash. A hard
    // reload of #reprogramacion intentionally opens that form again. Enter
    // the ordinary agenda before testing the newly confirmed date on reload.
    await page.goto(`/app/trabajos/${jobId}#agenda`)
    await expect(page).toHaveURL(new RegExp(`/app/trabajos/${jobId}#agenda$`))
    await expect(page.getByRole('heading', { name: 'Solicitar otra fecha', exact: true })).toHaveCount(0)

    await db.query(
      `update public.job_schedule_reservations
       set state='released',released_at=clock_timestamp(),released_reason='browser reschedule'
       where id=$1`,
      [firstScheduleId]
    )
    await db.query(`update public.jobs set schedule_version=2 where id=$1`, [jobId])
    await db.query(
      `insert into public.job_schedule_reservations(id,job_id,professional_id,version,starts_at,ends_at,local_visit_date,timezone,duration_minutes,travel_buffer_minutes,state,created_by)
       values($1,$2,$3,2,'2030-09-19 15:00:00+00','2030-09-19 17:00:00+00','2030-09-19','America/Argentina/Buenos_Aires',120,30,'confirmed',$4)`,
      [
        secondScheduleId,
        jobId,
        accounts.accounts.professionalApproved.entityId,
        accounts.accounts.professionalApproved.profileId
      ]
    )
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Visita confirmada', exact: true })).toBeVisible()
    await expect(page.locator('#agenda').getByText(/19 de septiembre/)).toBeVisible()
    await expect(page.locator('#agenda').getByText(/18 de septiembre/)).toHaveCount(0)
    await expect(page.locator('#agenda').getByText('12:00 a 14:00', { exact: true })).toBeVisible()

    await db.query(
      `insert into public.job_customer_decisions(id,job_id,customer_id,decision,idempotency_key,created_by)
       values($1,$2,$3,'confirmed',$4,$5)`,
      [
        decisionId,
        jobId,
        accounts.accounts.customerA.entityId,
        randomUUID(),
        accounts.accounts.customerA.profileId
      ]
    )
    await db.query(`update public.jobs set status='completed' where id=$1`, [jobId])
    await page.goto(`/app/trabajos/${jobId}/review`)
    await expect(page.getByRole('heading', { name: 'Calificar servicio' })).toBeVisible()
    await page.getByRole('radio', { name: '5 estrellas para el servicio' }).click()
    await page.getByRole('radio', { name: '5 estrellas para el profesional' }).click()
    await page.getByRole('radio', { name: 'Sí, quedó resuelto' }).click()
    await page.getByRole('radio', { name: 'Sí, volvería a elegir Lysto' }).click()
    await page.getByRole('button', { name: 'Enviar calificación' }).click()
    await expect(page.getByText('Calificación guardada.')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Ya calificaste este servicio')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar calificación', exact: true })).toHaveCount(0)
    expect((await db.query(
      'select count(*)::integer count from public.reviews where job_id=$1 and customer_id=$2',
      [jobId, accounts.accounts.customerA.entityId]
    )).rows[0].count).toBe(1)

    const logout = await page.request.post('/auth/logout', {
      headers: { Origin: new URL(page.url()).origin }, maxRedirects: 0
    })
    expect(logout.status()).toBe(303)
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login(?:\?|$)/)
    await loginAs(page, accounts.accounts.customerB, 'customerB')
    await page.goto(`/app/trabajos/${jobId}`)
    await expect(page.getByText('No encontramos un trabajo disponible para tu cuenta.')).toBeVisible()
    await page.goto(`/app/trabajos/${jobId}/review`)
    await expect(page.getByRole('heading', { name: 'Calificar servicio' })).toHaveCount(0)
  } finally {
    try {
      await db.query(`delete from private.outbox_events where aggregate_id=$1`, [jobId])
      await db.query(`delete from public.complaints where job_id=$1`, [jobId])
      await db.query(`delete from public.reviews where job_id=$1 and customer_id=$2`, [jobId, accounts.accounts.customerA.entityId])
      await db.query(`delete from public.job_customer_decisions where job_id=$1`, [jobId])
      await db.query(`delete from public.marketplace_checkouts where id=$1 and job_id=$2 and customer_id=$3`, [checkoutId, jobId, accounts.accounts.customerA.entityId])
      await db.query(`delete from public.jobs where id=$1 and customer_id=$2`, [jobId, accounts.accounts.customerA.entityId])
      await db.query(`delete from public.service_requests where id=$1 and customer_id=$2`, [requestId, accounts.accounts.customerA.entityId])
      await db.query(`delete from public.customer_addresses where id=$1 and customer_id=$2`, [addressId, accounts.accounts.customerA.entityId])
    } finally { await db.end() }
  }
})
