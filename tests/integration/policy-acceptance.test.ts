import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { createFixtureAccounts } from './fixtures'

describe('versioned policy acceptance', () => {
  let pending: ReturnType<typeof createFixtureAccounts> | undefined
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let database: Client
  const version = `test-service-${randomUUID()}`

  beforeAll(async () => {
    pending = createFixtureAccounts()
    fixture = await pending
    const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
    database = new Client({ connectionString: target.databaseUrl, connectionTimeoutMillis: 5_000 })
    await database.connect()
    await database.query(
      `insert into private.account_legal_documents(kind,version,document_url,content_sha256,approved_at,effective_at,approved_by)
       values('service',$1,'https://lysto.test/terminos',$2,clock_timestamp(),clock_timestamp(),'Synthetic approver')`,
      [version, 'a'.repeat(64)]
    )
  }, 180_000)

  afterAll(async () => {
    try {
      if (database) {
        await database.query('delete from private.policy_acceptances where version=$1', [version])
        await database.query(
          "delete from private.account_legal_documents where kind='service' and version=$1",
          [version]
        )
      }
    } finally {
      await database?.end()
      await pending?.cleanup()
    }
  }, 180_000)

  it('records immutable, idempotent acceptance of the current approved version', async () => {
    const account = fixture.accounts.customerA
    const args = {
      p_kind: 'service',
      p_version: version,
      p_subject_kind: 'account',
      p_subject_id: account.profileId,
      p_evidence: { source: 'integration', correlationId: randomUUID() }
    }
    const first = await account.client.rpc('record_policy_acceptance', args)
    const replay = await account.client.rpc('record_policy_acceptance', args)
    expect(first.error).toBeNull()
    expect(replay.error).toBeNull()
    expect(replay.data).toMatchObject({ id: (first.data as { id: string }).id, version })
    const rows = await database.query(
      'select count(*)::int total from private.policy_acceptances where profile_id=$1 and version=$2',
      [account.profileId, version]
    )
    expect(rows.rows[0].total).toBe(1)
  })

  it('rejects another role and unapproved versions', async () => {
    const denied = await fixture.accounts.finance.client.rpc('record_policy_acceptance', {
      p_kind: 'service',
      p_version: version,
      p_subject_kind: 'account',
      p_subject_id: fixture.accounts.finance.profileId,
      p_evidence: {}
    })
    expect(denied.error?.code).toBe('42501')
    const unavailable = await fixture.accounts.customerA.client.rpc('record_policy_acceptance', {
      p_kind: 'service',
      p_version: 'not-published',
      p_subject_kind: 'account',
      p_subject_id: fixture.accounts.customerA.profileId,
      p_evidence: {}
    })
    expect(unavailable.error?.code).toBe('40001')
  })
})
