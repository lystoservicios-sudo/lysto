import { describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { verifyRestore } from '../../scripts/lib/restore-verification.mjs'

describe('restore verifier against the disposable target', () => {
  it('reads migration, integrity and queue state without enabling side effects', async () => {
    const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
    await db.connect()
    const migrations = (
      await db.query('select version from supabase_migrations.schema_migrations order by version')
    ).rows.map((row) => String(row.version))
    await db.end()
    const started = new Date(Date.now() - 60000).toISOString(),
      completed = new Date().toISOString(),
      apiUrl = process.env.LYSTO_TEST_SUPABASE_URL!,
      projectId = process.env.LYSTO_TEST_PROJECT_ID!
    const result = await verifyRestore(
      {
        schemaVersion: 1,
        source: { backupCreatedAt: started, latestRecoverableAt: started },
        target: { projectId, apiUrl, production: false },
        restore: { startedAt: started, completedAt: completed },
        objectives: { rpoMinutes: 60, rtoMinutes: 240 },
        expected: {
          migrations,
          minimumCounts: { profiles: 0, jobs: 0, marketplace_checkouts: 0, outbox_events: 0 },
          storageObjects: [],
          syntheticAuth: false
        }
      },
      {
        ...process.env,
        APP_ENV: 'test',
        LYSTO_RESTORE_AUTHORIZED: 'yes',
        LYSTO_RESTORE_ALLOWED_PROJECT_IDS: projectId,
        LYSTO_RESTORE_API_URL: apiUrl,
        LYSTO_RESTORE_DATABASE_URL: process.env.LYSTO_TEST_DATABASE_URL,
        PAYMENTS_PROVIDER: 'mock',
        MERCADOPAGO_MODE: 'test',
        NOTIFICATIONS_EMAIL_ENABLED: 'false',
        OUTBOX_WORKER_ENABLED: 'false',
        REFUND_WORKER_ENABLED: 'false',
        LYSTO_ACCEPT_NEW_REQUESTS: 'false',
        LYSTO_ALLOW_NEW_CHECKOUTS: 'false'
      }
    )
    expect(result.status).toBe('passed')
    expect(result.checks).toEqual([
      'migration-history',
      'critical-counts',
      'referential-integrity',
      'storage-manifest'
    ])
  })
})
