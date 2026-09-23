import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

import { test, expect, loginAs } from './fixtures/production'

test('customer registration shows the approved legal consent without granting a professional account', async ({ page }) => {
  await page.goto('/registro')
  await expect(page.getByRole('heading', { name: 'Tu hogar, en buenas manos.' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Leí y acepto los términos/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /términos \(2026-09-21\)/ })).toHaveAttribute('href', 'https://lystohogar.com/terminos')
  await expect(page.getByRole('button', { name: 'Crear mi cuenta' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Crear cuenta para postularme/ })).toHaveCount(0)
})

test('customer reloads the live dashboard and empty request history', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  await expect(page.getByRole('heading', { name: /Hola, customerA/i })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Tu hogar todavía no tiene actividad')).toBeVisible()
  await page.goto('/app/solicitudes')
  await expect(page.getByRole('heading', { name: 'Mis solicitudes' })).toBeVisible()
  await expect(page.getByText('Todavía no tenés solicitudes')).toBeVisible()
})

test('a customer cannot load another customer identifier', async ({ page, accounts }) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  await page.goto(`/app/equipos/${accounts.accounts.customerB.entityId}`)
  await expect(page.getByRole('heading', { name: 'No encontramos ese equipo' })).toBeVisible()
})

test('customer follows visit links, sees reprogramming and submits one review', async ({
  page,
  accounts
}) => {
  // This complete two-customer journey makes several live staging round trips.
  test.setTimeout(60_000)
  const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const addressId = randomUUID(),
    requestId = randomUUID(),
    jobId = randomUUID(),
    firstScheduleId = randomUUID(),
    secondScheduleId = randomUUID(),
    decisionId = randomUUID()
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
    await expect(page.getByRole('heading', { name: 'Tu próximo servicio' })).toBeVisible()
    await expect(page.getByText('18 de septiembre de 2030')).toBeVisible()
    await expect(page.getByText('Calle Visita 2040, Buenos Aires')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Cómo llegar' })).toHaveAttribute(
      'href',
      /google\.com\/maps/
    )
    await page.goto(`/app/trabajos/${jobId}#reprogramacion`)
    await expect(page.getByRole('button', { name: 'Solicitar reprogramación' })).toBeVisible()
    await page.goto(`/app/trabajos/${jobId}#contacto`)
    await expect(page.getByRole('link', { name: 'Contactar a soporte de Lysto' })).toHaveAttribute(
      'href',
      `/app/garantias?jobId=${jobId}`
    )

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
    await expect(page.getByText('19 de septiembre de 2030')).toBeVisible()

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

    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/login\?logout=success/)
    await loginAs(page, accounts.accounts.customerB, 'customerB')
    await page.goto(`/app/trabajos/${jobId}`)
    await expect(page.getByText('No encontramos un trabajo disponible para tu cuenta.')).toBeVisible()
    await page.goto(`/app/trabajos/${jobId}/review`)
    await expect(page.getByRole('heading', { name: 'Calificar servicio' })).toHaveCount(0)
  } finally {
    await db.query(`delete from private.outbox_events where aggregate_id=$1`, [jobId])
    await db.query(`delete from public.complaints where job_id=$1`, [jobId])
    await db.query(`delete from public.reviews where job_id=$1`, [jobId])
    await db.query(`delete from public.job_customer_decisions where job_id=$1`, [jobId])
    await db.query(`delete from public.jobs where id=$1`, [jobId])
    await db.query(`delete from public.service_requests where id=$1`, [requestId])
    await db.query(`delete from public.customer_addresses where id=$1`, [addressId])
    await db.end()
  }
})
