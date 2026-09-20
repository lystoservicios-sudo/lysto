// Execute the new marketplace migration and SQL assertions in disposable transactions.
// LYSTO_STAGING_DATABASE_URL must point at a non-production staging database.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Client } from 'pg'

const connectionString = process.env.LYSTO_STAGING_DATABASE_URL
if (!connectionString || process.env.LYSTO_STAGING_CONFIRMED !== 'true')
  throw new Error('staging_connection_and_confirmation_required')
const url = new URL(connectionString)
if (url.username !== 'postgres.obksyzasmfwcbbksesqt' ||
    url.hostname !== 'aws-0-us-east-1.pooler.supabase.com')
  throw new Error('staging_connection_identity_required')

const migration = readFileSync('supabase/migrations/20260920171628_marketplace_orders.sql', 'utf8')
function expandSql(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/).map(line => {
    const include = line.match(/^\\ir\s+(\S+)\s*$/)
    return include ? expandSql(resolve(dirname(path), include[1])) : line
  }).join('\n')
}
const suites = [
  'supabase/tests/database/marketplace.test.sql',
  'supabase/tests/database/financial_exception_workflows.test.sql'
]
const client = new Client({ connectionString,
  ssl: process.env.LYSTO_STAGING_ALLOW_UNVERIFIED_TLS === 'true'
    ? { rejectUnauthorized: false } : { rejectUnauthorized: true } })
await client.connect()
try {
  for (const suite of suites) {
    await client.query('begin')
    try {
      const state = await client.query(`select
        exists(select 1 from supabase_migrations.schema_migrations where version=$1) as applied,
        to_regclass($2) is not null as order_table_exists`,
        ['20260920171628', 'private.marketplace_order_attempts'])
      if (state.rows[0].applied !== state.rows[0].order_table_exists)
        throw new Error('marketplace_orders_migration_history_mismatch')
      if (!state.rows[0].applied) await client.query(migration)
      await client.query('create extension if not exists pgtap with schema extensions')
      const sql = expandSql(suite)
        .replace(/^begin;\s*$/m, '')
        .replace(/^rollback;\s*$/m, '')
      const results = await client.query(sql)
      const assertions = (Array.isArray(results) ? results : [results])
        .flatMap(result => result.rows)
        .flatMap(row => Object.values(row))
        .filter(value => typeof value === 'string' && /^(?:not )?ok \d+/.test(value))
      const failed = assertions.filter(value => value.startsWith('not ok'))
      if (failed.length || !assertions.length)
        throw new Error(`${suite}: ${failed.join('; ') || 'no assertions found'}`)
      process.stdout.write(`${suite}: ${assertions.length} assertions passed; rollback\n`)
    } finally {
      await client.query('rollback')
    }
  }
} finally {
  await client.end()
}
