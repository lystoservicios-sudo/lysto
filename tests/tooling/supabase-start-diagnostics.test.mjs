import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const script = join(root, 'scripts/record-supabase-start-failure.mjs')
function cleanupTemporaryDirectory(temp) {
  assert.equal(dirname(resolve(temp)), resolve(tmpdir()))
  assert.match(basename(temp), /^lysto-supabase-start-(?:test|boundary)-/)
  rmSync(temp, { recursive: true, force: true })
}
async function sanitizer() {
  assert.ok(existsSync(script), 'Safe startup diagnostics implementation must exist')
  const diagnostics = await import('../../scripts/record-supabase-start-failure.mjs')
  assert.equal(typeof diagnostics.sanitizeSupabaseStartFailure, 'function')
  return diagnostics.sanitizeSupabaseStartFailure
}
const jwt = [Buffer.from('{"alg":"HS256"}').toString('base64url'), Buffer.from('{"iss":"artificial-test","role":"service_role"}').toString('base64url'), 'synthetic_signature_only'].join('.')
const pat = `github_pat_${'SYNTHETIC'.repeat(8)}`
const shortPat = `ghp_${'TESTONLY'.repeat(5)}`
const secret = `sb_secret_${'NOT_A_REAL_KEY'.repeat(4)}`
const publishable = `sb_publishable_${'NOT_A_REAL_KEY'.repeat(4)}`

test('retains useful SQLSTATE, migration and statement context while stripping terminal escapes', async () => {
  const sanitize = await sanitizer()
  const raw = '\x1b[31mApplying migration 20261013141601_customer_hogar.sql...\x1b[0m\n' +
    '\x1b]0;terminal title\x07ERROR: relation "public.customer_homes" does not exist (SQLSTATE 42P01)\n' +
    'At statement 3: select id from public.customer_homes;\n'
  const safe = sanitize(raw)
  assert.match(safe, /Applying migration 20261013141601_customer_hogar.sql/)
  assert.match(safe, /ERROR: relation "public.customer_homes" does not exist \(SQLSTATE 42P01\)/)
  assert.match(safe, /At statement 3: select id from public.customer_homes;/)
  assert.ok(!safe.includes('\x1b'))
  assert.ok(!safe.includes('terminal title'))
})

test('redacts standalone JWTs, Supabase keys and GitHub tokens wherever they occur', async () => {
  const sanitize = await sanitizer()
  const values = [jwt, pat, shortPat, secret, publishable, 'AKIA' + 'SYNTHETICKEY12345']
  const safe = sanitize(values.map(value => `Container diagnostic ${value}`).join('\n'))
  for (const value of values) assert.ok(!safe.includes(value), 'Credential must never be emitted')
})

test('redacts credential fields, authorization, cookies and quoted or spaced passwords', async () => {
  const sanitize = await sanitizer()
  const values = ['fake auth bearer', 'fake api value', 'fake access key', 'fake password with spaces', 'fake role secret', 'fake anonymous key', 'fake cookie secret']
  const raw = [
    `Authorization: Bearer ${values[0]}`,
    `API_KEY="${values[1]}"`,
    `access_key: '${values[2]}'`,
    `POSTGRES_PASSWORD = "${values[3]}"`,
    `│ service_role key │ ${values[4]} │`,
    `ANON_KEY: ${values[5]}`,
    `Cookie: session=${values[6]}`,
    'ERROR: syntax error at or near "create" (SQLSTATE 42601)'
  ].join('\n')
  const safe = sanitize(raw)
  for (const value of values) assert.ok(!safe.includes(value))
  assert.match(safe, /SQLSTATE 42601/)
})

test('removes authenticated URLs and token query URLs without obscuring harmless documentation URLs', async () => {
  const sanitize = await sanitizer()
  const values = [
    'postgresql://postgres:fake%20private%40pass@localhost:54322/postgres',
    'https://user:fake-private-password@example.invalid/path',
    'https://example.invalid/path?access_token=fake-private-query',
    'https://example.invalid/path?apikey=fake-private-key'
  ]
  const safe = sanitize(values.map(value => `ERROR: connection failed: ${value}`).join('\n') + '\nSee https://supabase.com/docs/guides/cli')
  for (const value of values) assert.ok(!safe.includes(value))
  for (const value of ['fake%20private%40pass', 'fake-private-password', 'fake-private-query', 'fake-private-key']) assert.ok(!safe.includes(value))
  assert.match(safe, /https:\/\/supabase.com\/docs\/guides\/cli/)
})

test('removes multiline private-key material and does not publish runtime status output', async () => {
  const sanitize = await sanitizer()
  const privateKey = ['-----BEGIN ', 'PRIVATE KEY-----'].join('') + '\nSYNTHETIC_PRIVATE_MATERIAL\n' + ['-----END ', 'PRIVATE KEY-----'].join('')
  const safe = sanitize(`Applying migration example.sql\n${privateKey}\nJWT secret: pretend-secret\nAPI URL: http://localhost:54321\nERROR: migration failed (SQLSTATE 22023)`)
  assert.ok(!safe.includes('SYNTHETIC_PRIVATE_MATERIAL'))
  assert.ok(!safe.includes('pretend-secret'))
  assert.ok(!safe.includes('API URL:'))
  assert.match(safe, /SQLSTATE 22023/)
})

test('records only sanitized failure evidence and leaves the original log private in runner temp', async () => {
  await sanitizer()
  const temp = mkdtempSync(join(tmpdir(), 'lysto-supabase-start-test-'))
  try {
    const runnerTemp = join(temp, 'runner-temp'), checkout = join(temp, 'checkout')
    mkdirSync(runnerTemp); mkdirSync(checkout)
    const source = join(runnerTemp, 'supabase-start.log')
    const raw = `Applying migration example.sql\nERROR: relation does not exist (SQLSTATE 42P01)\nAuthorization: Bearer ${jwt}\n${secret}`
    writeFileSync(source, raw)
    const result = spawnSync(process.execPath, [script, source], { cwd: checkout, env: { ...process.env, CI: 'true', RUNNER_TEMP: runnerTemp }, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const safe = readFileSync(join(checkout, 'output/ci/supabase-start-failure.log'), 'utf8')
    assert.match(safe, /SQLSTATE 42P01/)
    assert.ok(!safe.includes(jwt)); assert.ok(!safe.includes(secret))
    assert.equal(readFileSync(source, 'utf8'), raw)
    assert.ok(!result.stdout.includes(jwt)); assert.ok(!result.stderr.includes(jwt))
    assert.ok(!existsSync(join(checkout, 'output/ci/supabase-start.log')))
  } finally { cleanupTemporaryDirectory(temp) }
})

test('refuses source logs outside runner temp without creating an evidence artifact', async () => {
  await sanitizer()
  const temp = mkdtempSync(join(tmpdir(), 'lysto-supabase-start-boundary-'))
  try {
    const runnerTemp = join(temp, 'runner-temp'), checkout = join(temp, 'checkout')
    mkdirSync(runnerTemp); mkdirSync(checkout)
    const source = join(checkout, 'supabase-start.log')
    writeFileSync(source, secret)
    const result = spawnSync(process.execPath, [script, source], { cwd: checkout, env: { ...process.env, CI: 'true', RUNNER_TEMP: runnerTemp }, encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.ok(!result.stderr.includes(secret))
    assert.ok(!existsSync(join(checkout, 'output/ci/supabase-start-failure.log')))
  } finally { cleanupTemporaryDirectory(temp) }
})

test('workflow records a sanitized failure and preserves the failing startup exit code', () => {
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
  const startup = workflow.split('      - name: Start clean local Supabase')[1]?.split('      - name: Database permissions and schema tests')[0] ?? ''
  assert.match(startup, /if pnpm exec supabase start[^\n]+> "\$RUNNER_TEMP\/supabase-start\.log" 2>&1; then/)
  assert.match(startup, /supabase_start_status=\$\?/)
  assert.match(startup, /node scripts\/record-supabase-start-failure\.mjs "\$RUNNER_TEMP\/supabase-start\.log"/)
  assert.match(startup, /exit "\$supabase_start_status"/)
  assert.doesNotMatch(startup, /continue-on-error|supabase start[^\n]+\|\| true|supabase status|\benv\b|\bprintenv\b/)
  const upload = workflow.split('      - name: Collect evidence')[1]?.split('      - name: Stop only disposable CI stack')[0] ?? ''
  assert.match(upload, /if: always\(\)/)
  assert.doesNotMatch(upload, /supabase-start\.log|RUNNER_TEMP/)
})
