import { createHash, randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { chromium } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { Client } from 'pg'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { createFixtureAccounts, type AccountName } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'
import { cleanupExpiredUploads } from '@/lib/uploads/cleanup'

describe('private uploads through actual HTTP and Storage', () => {
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined
  let pendingApp: ReturnType<typeof startTestApp> | undefined
  let pending: ReturnType<typeof createFixtureAccounts> | undefined
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let database: Client | undefined
  let admin: SupabaseClient<Database>
  let png: Buffer
  const stored: Array<{ bucket: string; path: string }> = []
  const requestId = randomUUID(),
    jobId = randomUUID()
  beforeAll(async () => {
    pending = createFixtureAccounts()
    fixture = await pending
    const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
    admin = createClient<Database>(target.apiUrl, process.env.LYSTO_TEST_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) })
      }
    })
    database = new Client({
      connectionString: target.databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000
    })
    await database.connect()
    await database.query(
      `insert into public.service_requests (id,customer_id,category_id,issue_type_id,status)
      select $1,$2,c.id,i.id,'pending_assignment' from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.slug='aire_acondicionado' and i.slug='mantenimiento'`,
      [requestId, fixture.accounts.customerA.entityId]
    )
    await database.query(
      'insert into public.jobs (id,request_id,customer_id,professional_id,status) values ($1,$2,$3,$4,$5)',
      [
        jobId,
        requestId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId,
        'confirmed'
      ]
    )
    png = await sharp({ create: { width: 18, height: 12, channels: 3, background: '#345678' } })
      .png()
      .toBuffer()
    pendingApp = startTestApp()
    app = await pendingApp
  }, 300000)
  afterAll(async () => {
    try {
      await (app ?? (await pendingApp?.catch(() => undefined)))?.stop()
    } finally {
      try {
        if (database && fixture) {
          const paths = await database.query(
            'select quarantine_path,output_bucket,output_path from private.upload_intents where owner_profile_id=any($1::uuid[])',
            [Object.values(fixture.accounts).map((account) => account.profileId)]
          )
          for (const row of paths.rows)
            stored.push(
              { bucket: 'upload-quarantine', path: row.quarantine_path },
              { bucket: row.output_bucket, path: row.output_path }
            )
        }
        for (const item of stored) {
          const result = await admin.storage.from(item.bucket).remove([item.path])
          if (result.error) throw new Error('Test Storage cleanup failed')
        }
        if (database && fixture) {
          const profiles = Object.values(fixture.accounts).map((account) => account.profileId)
          await database.query(
            'delete from public.request_media where uploaded_by=any($1::uuid[])',
            [profiles]
          )
          await database.query('delete from public.job_media where uploaded_by=any($1::uuid[])', [
            profiles
          ])
          await database.query(
            'delete from public.equipment_media where uploaded_by=any($1::uuid[])',
            [profiles]
          )
          await database.query(
            'delete from public.professional_documents where professional_id=any($1::uuid[])',
            [Object.values(fixture.accounts).map((account) => account.entityId)]
          )
          await database.query(
            'delete from private.upload_intents where owner_profile_id=any($1::uuid[])',
            [profiles]
          )
          await database.query(
            'delete from private.request_upload_drafts where owner_profile_id=any($1::uuid[])',
            [profiles]
          )
          await database.query('delete from public.service_requests where id=$1', [requestId])
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
  async function post(path: string, body: unknown, account: AccountName = 'customerA') {
    return fetch(new URL(path, app!.baseURL), {
      method: 'POST',
      headers: {
        Origin: app!.baseURL,
        'Content-Type': 'application/json',
        Cookie: await fixtureCookieHeader(fixture.accounts[account])
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000)
    })
  }
  async function sign(body: Record<string, unknown> = {}, account: AccountName = 'customerA') {
    const response = await post(
      '/api/uploads/sign',
      {
        kind: 'request-photo',
        mimeType: 'image/png',
        sizeBytes: png.length,
        sha256: createHash('sha256').update(png).digest('hex'),
        ...body
      },
      account
    )
    expect(response.status).toBe(200)
    return response.json()
  }
  async function put(
    signed: { bucket: string; path: string; token: string },
    bytes = png,
    account: AccountName = 'customerA'
  ) {
    return fixture.accounts[account].client.storage
      .from(signed.bucket)
      .uploadToSignedUrl(signed.path, signed.token, bytes, {
        contentType: 'image/png',
        upsert: false
      })
  }
  it('verifies equipment photos, isolates readers and preserves archived evidence', async () => {
    const registered = await post('/api/equipment/register', {
      nickname: 'Equipo con foto',
      equipmentType: 'split'
    })
    expect(registered.status).toBe(201)
    const { equipment } = await registered.json()
    const signed = await sign({ kind: 'equipment-photo', entityId: equipment.id })
    expect((await put(signed)).error).toBeNull()
    const finalized = await post('/api/uploads/finalize', { intentId: signed.intentId })
    expect(finalized.status).toBe(200)
    const attachment = await finalized.json()
    expect(attachment.bucket).toBe('equipment-media')
    expect(
      (
        await database!.query('select equipment_id from public.equipment_media where id=$1', [
          attachment.id
        ])
      ).rows[0].equipment_id
    ).toBe(equipment.id)
    expect(
      (await post('/api/uploads/read', { intentId: signed.intentId }, 'customerB')).status
    ).toBe(404)
    expect(
      (await post('/api/uploads/read', { intentId: signed.intentId }, 'professionalApproved'))
        .status
    ).toBe(404)
    expect(
      (await post('/api/uploads/read', { intentId: signed.intentId }, 'operations')).status
    ).toBe(200)
    expect(
      (
        await fixture.accounts.customerA.client
          .from('equipment_media')
          .insert({
            id: randomUUID(),
            equipment_id: equipment.id,
            storage_bucket: 'equipment-media',
            storage_path: 'fake',
            uploaded_by: fixture.accounts.customerA.profileId
          })
      ).error?.code
    ).toBe('42501')
    const read = await (await post('/api/uploads/read', { intentId: signed.intentId })).json()
    expect(read.expiresIn).toBe(60)
    const response = await fetch(read.url)
    expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format).toBe('webp')
    const archived = await fetch(new URL('/api/customer/equipment', app!.baseURL), {
      method: 'DELETE',
      headers: {
        Origin: app!.baseURL,
        'Content-Type': 'application/json',
        Cookie: await fixtureCookieHeader(fixture.accounts.customerA)
      },
      body: JSON.stringify({ id: equipment.id, expectedVersion: equipment.version }),
      signal: AbortSignal.timeout(90000)
    })
    expect(archived.status).toBe(200)
    expect((await post('/api/uploads/read', { intentId: signed.intentId })).status).toBe(200)
    expect(
      (
        await post('/api/uploads/sign', {
          kind: 'equipment-photo',
          entityId: equipment.id,
          mimeType: 'image/png',
          sizeBytes: png.length,
          sha256: createHash('sha256').update(png).digest('hex')
        })
      ).status
    ).toBe(404)
  }, 180000)
  it('registers equipment and saves a photo through the browser, then reloads verified evidence', async () => {
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
      await page.goto(`${app!.baseURL}/app/equipos`)
      await page.getByLabel('Nombre del equipo').fill('Equipo navegador')
      await page.getByRole('button', { name: 'Registrar equipo', exact: true }).click()
      await page.getByText('Equipo registrado. Ya podés agregar sus fotos.').waitFor()
      await page
        .getByLabel('Agregar fotos')
        .setInputFiles({ name: 'equipo.png', mimeType: 'image/png', buffer: png })
      await page.getByRole('button', { name: /Guardar fotos/ }).click()
      await page.getByText('Guardada y verificada', { exact: true }).waitFor()
      await page.reload()
      await page.getByRole('button', { name: 'Fotos de Equipo navegador', exact: true }).click()
      await page.getByRole('button', { name: 'Consultar fotos guardadas', exact: true }).click()
      await page.getByRole('button', { name: 'Ver foto 1', exact: true }).click()
      const photo = page.getByRole('img', { name: 'Foto guardada del equipo', exact: true })
      await photo.waitFor()
      await photo.evaluate(async (element) => {
        if (element instanceof HTMLImageElement) await element.decode()
      })
    } finally {
      await browser.close()
    }
  }, 120000)
  it('persists a selected photo in an owned draft only after inspecting the bytes', async () => {
    const response = await post('/api/uploads/sign', {
      kind: 'request-photo',
      mimeType: 'image/png',
      sizeBytes: png.length,
      sha256: createHash('sha256').update(png).digest('hex')
    })
    expect(response.status).toBe(200)
    const signed = await response.json()
    expect(signed.draftId).toMatch(/^[a-f0-9-]{36}$/)
    stored.push({ bucket: signed.bucket, path: signed.path })
    const upload = await fixture.accounts.customerA.client.storage
      .from(signed.bucket)
      .uploadToSignedUrl(signed.path, signed.token, png, {
        contentType: 'image/png',
        upsert: false
      })
    expect(upload.error).toBeNull()
    const before = await post('/api/uploads/read', { intentId: signed.intentId })
    expect(before.status).toBe(404)
    const finalized = await post('/api/uploads/finalize', { intentId: signed.intentId })
    expect(finalized.status).toBe(200)
    const attachment = await finalized.json()
    expect(attachment.status).toBe('verified')
    const unrestrictedLink = await fixture.accounts.customerA.client.storage
      .from(attachment.bucket)
      .createSignedUrl(attachment.path, 31536000)
    expect(unrestrictedLink.error).not.toBeNull()
    const read = await post('/api/uploads/read', { intentId: signed.intentId })
    expect(read.status).toBe(200)
    const readable = await read.json()
    stored.push({ bucket: attachment.bucket, path: attachment.path })
    const bytes = await fetch(readable.url)
    expect(bytes.status).toBe(200)
    expect((await sharp(Buffer.from(await bytes.arrayBuffer())).metadata()).format).toBe('webp')
    const other = await post('/api/uploads/read', { intentId: signed.intentId }, 'customerB')
    expect(other.status).toBe(404)
    const repeated = await post('/api/uploads/finalize', { intentId: signed.intentId })
    expect((await repeated.json()).attachmentId).toBe(attachment.attachmentId)
  }, 180000)
  it.each([
    { sizeBytes: 0 },
    { sizeBytes: 10 * 1024 * 1024 + 1 },
    { sizeBytes: 0.5 },
    { mimeType: 'application/pdf' },
    { kind: 'request-video', mimeType: 'video/mp4' },
    { sha256: 'not-a-hash' },
    { entityId: '../foreign/path' },
    { ownerId: '75000000-0000-4000-8000-000000000001' }
  ])('rejects invalid declaration %j', async (patch) => {
    const response = await post('/api/uploads/sign', {
      kind: 'request-photo',
      mimeType: 'image/png',
      sizeBytes: png.length,
      sha256: createHash('sha256').update(png).digest('hex'),
      ...patch
    })
    expect(response.status).toBe(400)
  })
  it('refuses foreign entities and professional uploads by suspended accounts', async () => {
    expect(
      (
        await post(
          '/api/uploads/sign',
          {
            kind: 'request-photo',
            mimeType: 'image/png',
            sizeBytes: png.length,
            sha256: createHash('sha256').update(png).digest('hex'),
            entityId: requestId
          },
          'customerB'
        )
      ).status
    ).toBe(404)
    expect(
      (
        await post(
          '/api/uploads/sign',
          {
            kind: 'job-photo',
            mimeType: 'image/png',
            sizeBytes: png.length,
            sha256: createHash('sha256').update(png).digest('hex'),
            entityId: jobId,
            phase: 'before'
          },
          'professionalSuspended'
        )
      ).status
    ).toBe(403)
  })
  it('rejects forged and replayed upload tokens while keeping raw content unreadable', async () => {
    const signed = await sign()
    expect((await put({ ...signed, token: `${signed.token}x` })).error).not.toBeNull()
    expect((await put(signed)).error).toBeNull()
    expect((await put(signed)).error).not.toBeNull()
    expect(
      (
        await fixture.accounts.customerA.client.storage
          .from(signed.bucket)
          .createSignedUrl(signed.path, 60)
      ).error
    ).not.toBeNull()
    expect(
      (await post('/api/uploads/finalize', { intentId: signed.intentId }, 'customerB')).status
    ).toBe(404)
  })
  it('rejects bytes that only claim to be a photo', async () => {
    const fake = Buffer.from('<svg><script>bad content</script></svg>')
    const signed = await sign({
      sizeBytes: fake.length,
      sha256: createHash('sha256').update(fake).digest('hex')
    })
    expect((await put(signed, fake)).error).toBeNull()
    expect((await post('/api/uploads/finalize', { intentId: signed.intentId })).status).toBe(400)
    expect((await post('/api/uploads/read', { intentId: signed.intentId })).status).toBe(404)
    expect(
      (
        await database!.query('select status from private.upload_intents where id=$1', [
          signed.intentId
        ])
      ).rows[0].status
    ).toBe('pending')
  })
  it('rejects mismatched size and hash during actual inspection', async () => {
    for (const patch of [{ sizeBytes: png.length + 1 }, { sha256: 'a'.repeat(64) }]) {
      const signed = await sign(patch)
      expect((await put(signed)).error).toBeNull()
      expect((await post('/api/uploads/finalize', { intentId: signed.intentId })).status).toBe(400)
    }
  })
  it('returns a recoverable expired-intent response after the finalization deadline', async () => {
    const signed = await sign()
    expect((await put(signed)).error).toBeNull()
    await database!.query(
      "update private.upload_intents set expires_at=now()-interval '1 minute' where id=$1",
      [signed.intentId]
    )
    expect((await post('/api/uploads/finalize', { intentId: signed.intentId })).status).toBe(410)
  })
  it('links job evidence once and applies current reader permissions', async () => {
    const signed = await sign(
      { kind: 'job-photo', entityId: jobId, phase: 'before' },
      'professionalApproved'
    )
    expect((await put(signed, png, 'professionalApproved')).error).toBeNull()
    const results = await Promise.all([
      post('/api/uploads/finalize', { intentId: signed.intentId }, 'professionalApproved'),
      post('/api/uploads/finalize', { intentId: signed.intentId }, 'professionalApproved')
    ])
    expect(results.map((result) => result.status)).toEqual([200, 200])
    expect(
      (
        await database!.query('select count(*)::int n from public.job_media where id=$1', [
          signed.intentId
        ])
      ).rows[0].n
    ).toBe(1)
    for (const account of [
      'customerA',
      'professionalApproved',
      'operations',
      'quality',
      'owner'
    ] as const)
      expect((await post('/api/uploads/read', { intentId: signed.intentId }, account)).status).toBe(
        200
      )
    for (const account of ['customerB', 'finance'] as const)
      expect((await post('/api/uploads/read', { intentId: signed.intentId }, account)).status).toBe(
        404
      )
    await database!.query(
      "update public.professional_profiles set status='suspended' where id=$1",
      [fixture.accounts.professionalApproved.entityId]
    )
    try {
      expect(
        (await post('/api/uploads/read', { intentId: signed.intentId }, 'professionalApproved'))
          .status
      ).toBe(403)
    } finally {
      await database!.query(
        "update public.professional_profiles set status='approved' where id=$1",
        [fixture.accounts.professionalApproved.entityId]
      )
    }
  }, 180000)
  it('cleans expired orphan objects while preserving verified attachments', async () => {
    const orphan = await sign(),
      verified = await sign()
    expect((await put(orphan)).error).toBeNull()
    expect((await put(verified)).error).toBeNull()
    expect((await post('/api/uploads/finalize', { intentId: verified.intentId })).status).toBe(200)
    await database!.query(
      "update private.upload_intents set expires_at=now()-interval '1 hour',cleanup_after=now()-interval '1 minute' where id=any($1::uuid[])",
      [[orphan.intentId, verified.intentId]]
    )
    expect(await cleanupExpiredUploads(admin)).toEqual({ claimed: 1, cleaned: 1, failed: 0 })
    expect(
      (
        await database!.query('select status from private.upload_intents where id=$1', [
          orphan.intentId
        ])
      ).rows[0].status
    ).toBe('cleaned')
    expect(
      (
        await database!.query(
          'select count(*)::int n from storage.objects where bucket_id=$1 and name=$2',
          [orphan.bucket, orphan.path]
        )
      ).rows[0].n
    ).toBe(0)
    expect((await post('/api/uploads/read', { intentId: verified.intentId })).status).toBe(200)
    expect(await cleanupExpiredUploads(admin)).toEqual({ claimed: 0, cleaned: 0, failed: 0 })
  })
  it('verifies professional and job document images as private JPEG attachments', async () => {
    for (const declaration of [
      {
        kind: 'professional-document',
        entityId: fixture.accounts.professionalApproved.entityId,
        documentType: 'identity'
      },
      { kind: 'job-document', entityId: jobId, phase: 'document' }
    ]) {
      const signed = await sign(declaration, 'professionalApproved')
      expect((await put(signed, png, 'professionalApproved')).error).toBeNull()
      const finalized = await post(
        '/api/uploads/finalize',
        { intentId: signed.intentId },
        'professionalApproved'
      )
      expect(finalized.status).toBe(200)
      const attachment = await finalized.json()
      expect(attachment.path).toMatch(/\.jpg$/)
      const read = await post(
        '/api/uploads/read',
        { intentId: signed.intentId },
        'professionalApproved'
      )
      const response = await fetch((await read.json()).url)
      expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format).toBe(
        'jpeg'
      )
      const table =
        declaration.kind === 'professional-document' ? 'professional_documents' : 'job_media'
      expect(
        (
          await database!.query(`select count(*)::int n from public.${table} where id=$1`, [
            signed.intentId
          ])
        ).rows[0].n
      ).toBe(1)
    }
  })
})
