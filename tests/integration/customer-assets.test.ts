import { Client } from 'pg'
import { chromium } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFixtureAccounts, type AccountName } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'

describe('persistent customer profiles, addresses and equipment', () => {
  let pending: ReturnType<typeof createFixtureAccounts>
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined
  let pendingApp: ReturnType<typeof startTestApp> | undefined
  let database: Client | undefined
  let mailOrigin = ''
  const mailIds = new Set<string>()
  const ownedRequests: string[] = []
  beforeAll(async () => {
    pending = createFixtureAccounts()
    fixture = await pending
    const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
    const api = new URL(target.apiUrl)
    mailOrigin = `${api.protocol}//${api.hostname}:${target.projectId === 'lysto_production_check' ? 56324 : 54324}`
    database = new Client({
      connectionString: target.databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000
    })
    await database.connect()
    pendingApp = startTestApp()
    app = await pendingApp
  }, 300000)
  afterAll(async () => {
    try {
      await (app ?? (await pendingApp?.catch(() => undefined)))?.stop()
    } finally {
      try {
        if (ownedRequests.length)
          await database!.query(
            'delete from public.service_requests where id=any($1::uuid[]) and customer_id=$2',
            [ownedRequests, fixture.accounts.customerA.entityId]
          )
        if (mailIds.size) {
          const response = await fetch(`${mailOrigin}/api/v1/messages`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ IDs: [...mailIds] }),
            signal: AbortSignal.timeout(10000)
          })
          if (!response.ok) throw new Error('Owned email cleanup failed')
        }
      } finally {
        try {
          await database?.end()
        } finally {
          await pending?.cleanup()
        }
      }
    }
  }, 180000)
  async function request(
    path: string,
    actor: AccountName = 'customerA',
    method = 'GET',
    body?: unknown
  ) {
    return fetch(new URL(path, app!.baseURL), {
      method,
      redirect: 'manual',
      headers: {
        Origin: app!.baseURL,
        Cookie: await fixtureCookieHeader(fixture.accounts[actor]),
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(90000)
    })
  }
  const addressInput = {
    label: 'Casa',
    street: 'Corrientes',
    number: '1234',
    city: 'CABA',
    province: 'CABA',
    propertyType: 'apartment',
    access: { hasElevator: true },
    isDefault: true
  }
  async function address() {
    const response = await request('/api/customer/addresses', 'customerA', 'POST', addressInput)
    expect(response.status).toBe(201)
    return (await response.json()).address as { id: string; version: number }
  }
  it('persists editable profile fields, retains Auth identity and rejects stale versions', async () => {
    const initial = await request('/api/customer/profile')
    expect(initial.status).toBe(200)
    const { profile } = await initial.json()
    expect(profile.email).toBe(fixture.accounts.customerA.email)
    const input = {
      firstName: 'Nombre actualizado',
      lastName: 'Cliente',
      phone: '1155551234',
      notificationPreference: 'email',
      expectedVersion: profile.version
    }
    const saved = await request('/api/customer/profile', 'customerA', 'PUT', input)
    expect(saved.status).toBe(200)
    expect((await saved.json()).profile).toMatchObject({
      firstName: input.firstName,
      version: profile.version + 1
    })
    expect((await request('/api/customer/profile', 'customerA', 'PUT', input)).status).toBe(409)
    expect((await (await request('/api/customer/profile')).json()).profile.firstName).toBe(
      input.firstName
    )
  })
  it('rejects role, owner and direct email changes before writing a profile', async () => {
    const response = await request('/api/customer/profile', 'customerA', 'PUT', {
      role: 'admin',
      profileId: fixture.accounts.customerB.profileId,
      email: 'replacement@lysto.test',
      firstName: 'Untrusted',
      lastName: 'Caller',
      phone: '1155551234',
      notificationPreference: 'email',
      expectedVersion: 1
    })
    expect(response.status).toBe(400)
    const other = await request('/api/customer/profile', 'customerB')
    expect((await other.json()).profile.firstName).toBe('customerB')
    expect(
      (await fixture.accounts.customerA.client.auth.getUser()).data.user?.app_metadata.app_role
    ).toBe('customer')
  })
  it('stores and reloads own addresses without exposing them to another customer', async () => {
    const saved = await address()
    const own = await (await request('/api/customer/addresses')).json()
    expect(own.items.some((item: { id: string }) => item.id === saved.id)).toBe(true)
    const other = await (await request('/api/customer/addresses', 'customerB')).json()
    expect(other.items.some((item: { id: string }) => item.id === saved.id)).toBe(false)
    const denied = await request('/api/customer/addresses', 'customerB', 'PUT', {
      ...addressInput,
      id: saved.id,
      expectedVersion: saved.version
    })
    expect(denied.status).toBe(404)
  })
  it('serializes concurrent address edits and keeps exactly one default', async () => {
    const saved = await address()
    const results = await Promise.all(
      ['Primera', 'Segunda'].map((label) =>
        request('/api/customer/addresses', 'customerA', 'PUT', {
          ...addressInput,
          label,
          id: saved.id,
          expectedVersion: saved.version
        })
      )
    )
    expect(results.map((result) => result.status).sort()).toEqual([200, 409])
    expect(
      (
        await database!.query(
          'select count(*)::int as n from public.customer_addresses where customer_id=$1 and is_default',
          [fixture.accounts.customerA.entityId]
        )
      ).rows[0].n
    ).toBe(1)
  })
  it('archives addresses and refuses subsequent edits instead of silently deleting them', async () => {
    const saved = await address()
    expect(
      (
        await request('/api/customer/addresses', 'customerA', 'DELETE', {
          id: saved.id,
          expectedVersion: saved.version
        })
      ).status
    ).toBe(200)
    const row = (
      await database!.query('select archived_at from public.customer_addresses where id=$1', [
        saved.id
      ])
    ).rows[0]
    expect(row.archived_at).toBeTruthy()
    expect(
      (
        await request('/api/customer/addresses', 'customerA', 'PUT', {
          ...addressInput,
          id: saved.id,
          expectedVersion: saved.version
        })
      ).status
    ).toBe(404)
  })
  it('registers optional equipment details with an owned address and archives without losing the record', async () => {
    const savedAddress = await address()
    const result = await request('/api/equipment/register', 'customerA', 'POST', {
      nickname: 'Equipo dormitorio',
      addressId: savedAddress.id,
      equipmentType: 'split'
    })
    expect(result.status).toBe(201)
    const { equipment } = await result.json()
    expect(equipment).toMatchObject({
      nickname: 'Equipo dormitorio',
      brand: null,
      model: null,
      serialNumber: null
    })
    expect(
      (
        await request('/api/customer/equipment', 'customerB', 'DELETE', {
          id: equipment.id,
          expectedVersion: equipment.version
        })
      ).status
    ).toBe(404)
    expect(
      (
        await request('/api/customer/equipment', 'customerA', 'DELETE', {
          id: equipment.id,
          expectedVersion: equipment.version
        })
      ).status
    ).toBe(200)
    expect(
      (
        await database!.query('select archived_at from public.customer_equipment where id=$1', [
          equipment.id
        ])
      ).rows[0].archived_at
    ).toBeTruthy()
  })
  it('rejects equipment registration against a foreign address and unverified photo claims', async () => {
    const saved = await address()
    expect(
      (
        await request('/api/equipment/register', 'customerB', 'POST', {
          nickname: 'Ajeno',
          addressId: saved.id,
          equipmentType: 'split'
        })
      ).status
    ).toBe(404)
    expect(
      (
        await request('/api/equipment/register', 'customerA', 'POST', {
          nickname: 'Foto falsa',
          addressId: saved.id,
          equipmentType: 'split',
          photoUrl: 'https://untrusted.invalid/fake.jpg',
          indoorPhotoCount: 1
        })
      ).status
    ).toBe(400)
  })
  it('preserves the address referenced by equipment when the customer edits it', async () => {
    const saved = await address()
    const registered = await request('/api/equipment/register', 'customerA', 'POST', {
      nickname: 'Historial',
      addressId: saved.id,
      equipmentType: 'split'
    })
    expect(registered.status).toBe(201)
    const equipment = (await registered.json()).equipment
    const edited = await request('/api/customer/addresses', 'customerA', 'PUT', {
      ...addressInput,
      id: saved.id,
      expectedVersion: saved.version,
      street: 'Nueva calle',
      propertyType: 'office'
    })
    expect(edited.status).toBe(200)
    const replacement = await edited.json()
    expect(replacement.replacedId).toBe(saved.id)
    expect(replacement.address.id).not.toBe(saved.id)
    const old = (
      await database!.query(
        'select street,archived_at from public.customer_addresses where id=$1',
        [saved.id]
      )
    ).rows[0]
    expect(old.street).toBe(addressInput.street)
    expect(old.archived_at).toBeTruthy()
    expect(
      (
        await database!.query('select address_id from public.customer_equipment where id=$1', [
          equipment.id
        ])
      ).rows[0].address_id
    ).toBe(saved.id)
  })
  it('links equipment to an owned request and keeps its archived history private and navigable', async () => {
    const location = await address()
    const requestId = randomUUID(),
      jobId = randomUUID()
    ownedRequests.push(requestId)
    await database!.query(
      `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,address_id)
      select $1,$2,c.id,i.id,'pending_assignment',$3 from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.slug='aire_acondicionado' and i.slug='mantenimiento'`,
      [requestId, fixture.accounts.customerA.entityId, location.id]
    )
    await database!.query(
      "insert into public.jobs(id,request_id,customer_id,status) values($1,$2,$3,'confirmed')",
      [jobId, requestId, fixture.accounts.customerA.entityId]
    )
    expect(
      (
        await request('/api/equipment/register', 'customerB', 'POST', {
          nickname: 'Ajeno',
          equipmentType: 'split',
          jobId
        })
      ).status
    ).toBe(404)
    const response = await request('/api/equipment/register', 'customerA', 'POST', {
      nickname: 'Historial conservado',
      equipmentType: 'split',
      requestId,
      jobId
    })
    expect(response.status).toBe(201)
    const { equipment } = await response.json()
    expect(equipment.addressId).toBe(location.id)
    expect(
      (
        await database!.query('select equipment_id from public.service_requests where id=$1', [
          requestId
        ])
      ).rows[0].equipment_id
    ).toBe(equipment.id)
    await database!.query(
      'insert into public.equipment_service_records(equipment_id,job_id,work_done,notes) values($1,$2,$3,$4)',
      [equipment.id, jobId, 'Intervención registrada', 'PRIVATE_TECHNICIAN_NOTE_T13']
    )
    expect(
      (
        await request('/api/customer/equipment', 'customerA', 'DELETE', {
          id: equipment.id,
          expectedVersion: equipment.version
        })
      ).status
    ).toBe(200)
    const detail = await request(`/app/equipos/${equipment.id}`)
    expect(detail.status).toBe(200)
    const html = await detail.text()
    expect(html).toContain('Intervención registrada')
    expect(html).toContain('Equipo archivado')
    expect(html).not.toContain('PRIVATE_TECHNICIAN_NOTE_T13')
    const foreignPage = await request(`/app/equipos/${equipment.id}`, 'customerB')
    // Next.js can start streaming the layout before notFound resolves. Verify
    // the rendered denial and absence of customer data, not only the HTTP code.
    expect([200, 404]).toContain(foreignPage.status)
    const foreignHtml = await foreignPage.text()
    expect(foreignHtml).toContain('No encontramos ese equipo')
    expect(foreignHtml).not.toContain('Historial conservado')
    expect(foreignHtml).not.toContain('Intervención registrada')
    expect(foreignHtml).not.toContain('PRIVATE_TECHNICIAN_NOTE_T13')
    expect(await (await request('/app/equipos/archivo')).text()).toContain('Historial conservado')
  }, 90000)
  it('cannot bypass field and owner checks through the direct RPC or REST tables', async () => {
    const actor = fixture.accounts.customerA.client
    expect(
      (
        await actor.rpc('write_customer_asset', {
          p_kind: 'profile',
          p_id: fixture.accounts.customerB.profileId,
          p_expected_version: 1,
          p_data: {
            firstName: 'Bad',
            lastName: 'Caller',
            phone: '1155551234',
            notificationPreference: 'email'
          },
          p_archive: false
        })
      ).error?.code
    ).toBe('P0002')
    expect(
      (
        await actor.rpc('write_customer_asset', {
          p_kind: 'profile',
          p_id: fixture.accounts.customerA.profileId,
          p_expected_version: 1,
          p_data: { role: 'admin' },
          p_archive: false
        })
      ).error?.code
    ).toBe('22023')
    expect(
      (
        await actor
          .from('profiles')
          .update({ first_name: 'Bypass' })
          .eq('id', fixture.accounts.customerA.profileId)
      ).error?.code
    ).toBe('42501')
  })
  it('saves and reloads profile and address changes through a real browser', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext()
      const cookies = await fixtureCookieHeader(fixture.accounts.customerA)
      await context.addCookies(
        cookies.split('; ').map((cookie) => {
          const at = cookie.indexOf('=')
          return {
            name: cookie.slice(0, at),
            value: cookie.slice(at + 1),
            url: app!.baseURL,
            sameSite: 'Lax' as const
          }
        })
      )
      const page = await context.newPage()
      await page.goto(`${app!.baseURL}/app/perfil`)
      await page.getByLabel('Nombre', { exact: true }).fill('Cliente navegador')
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
      await page.getByText('Tus cambios quedaron guardados.').waitFor()
      await page.reload()
      expect(await page.getByLabel('Nombre', { exact: true }).inputValue()).toBe(
        'Cliente navegador'
      )
      await page.goto(`${app!.baseURL}/app/direcciones`)
      for (const [name, value] of [
        ['Nombre de la dirección', 'Oficina navegador'],
        ['Calle', 'San Martín'],
        ['Número', '432'],
        ['Ciudad', 'Buenos Aires'],
        ['Provincia', 'Buenos Aires']
      ])
        await page.getByLabel(name, { exact: false }).fill(value)
      await page.getByLabel('Tipo de propiedad').selectOption('office')
      await page.getByRole('button', { name: 'Guardar dirección', exact: true }).click()
      await page.getByText('La dirección quedó guardada.', { exact: true }).waitFor()
      await page.reload()
      await page.getByRole('heading', { name: 'Oficina navegador', exact: true }).waitFor()
    } finally {
      await browser.close()
    }
  }, 120000)
  it('requires confirmations from both real mailboxes before synchronizing the profile email', async () => {
    const account = fixture.accounts.customerB
    const nextEmail = account.email.replace('@', '.changed@')
    const result = await request('/api/customer/profile/email', 'customerB', 'POST', {
      email: nextEmail
    })
    expect(result.status).toBe(202)
    async function tokenFor(email: string) {
      const deadline = Date.now() + 30000
      while (Date.now() < deadline) {
        const search = await fetch(
          `${mailOrigin}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
          { signal: AbortSignal.timeout(10000) }
        )
        const messages = (await search.json()).messages as Array<{ ID: string; Subject: string }>
        const found = messages.find((item) => item.Subject.includes('cambio de correo'))
        if (found) {
          mailIds.add(found.ID)
          const message = await (
            await fetch(`${mailOrigin}/api/v1/message/${encodeURIComponent(found.ID)}`, {
              signal: AbortSignal.timeout(10000)
            })
          ).json()
          const token = /token_hash=([a-zA-Z0-9_-]+)/.exec(message.HTML)?.[1]
          if (!token) throw new Error('Confirmation token missing from owned mailbox')
          return token
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error('Local change-email message was not delivered')
    }
    const tokens = await Promise.all([tokenFor(account.email), tokenFor(nextEmail)])
    async function currentEmail() {
      return (
        await database!.query('select email from public.profiles where id=$1', [account.profileId])
      ).rows[0].email
    }
    for (const token of tokens)
      expect((await request(`/auth/change-email?token_hash=${token}`, 'customerB')).status).toBe(
        200
      )
    expect(await currentEmail()).toBe(account.email)
    for (let index = 0; index < tokens.length; index++) {
      const confirmation = await fetch(`${app!.baseURL}/auth/change-email`, {
        method: 'POST',
        headers: { Origin: app!.baseURL },
        body: new URLSearchParams({ token_hash: tokens[index] }),
        redirect: 'manual',
        signal: AbortSignal.timeout(90000)
      })
      expect(confirmation.status).toBe(200)
      expect(await currentEmail()).toBe(index === 0 ? account.email : nextEmail)
    }
    expect((await account.client.auth.getUser()).data.user?.email).toBe(nextEmail)
    const reused = await fetch(`${app!.baseURL}/auth/change-email`, {
      method: 'POST',
      headers: { Origin: app!.baseURL },
      body: new URLSearchParams({ token_hash: tokens[1] }),
      signal: AbortSignal.timeout(90000)
    })
    expect(reused.status).toBe(400)
  }, 120000)
})
