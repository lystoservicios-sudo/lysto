import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import {
  assertStagingTarget,
  verifyPlaywrightCoverage
} from '../../lib/release/staging-evidence.ts'

try {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  if (args.length > 1 || (args.length === 1 && args[0] !== '--list'))
    throw new Error(
      'Staging only accepts --list; partial suites and overridden safety settings are prohibited'
    )
  if (!process.env.LYSTO_STAGING_IDENTITY_FILE)
    throw new Error(
      'LYSTO_STAGING_IDENTITY_FILE must identify the approved staging project and QA resources'
    )
  const identityPath = realpathSync(resolve(process.env.LYSTO_STAGING_IDENTITY_FILE))
  const identityRelative = relative(realpathSync(process.cwd()), identityPath)
  if (
    !isAbsolute(identityRelative) &&
    identityRelative !== '..' &&
    !identityRelative.startsWith(`..${sep}`)
  )
    throw new Error('Staging identity must be protected configuration outside the checkout')
  const target = assertStagingTarget(process.env, JSON.parse(readFileSync(identityPath, 'utf8')))
  const required = [
    'auth-access',
    'customer-production',
    'professional-production',
    'admin-production',
    'service-lifecycle',
    'financial-exceptions',
    'accessibility'
  ]
  for (const suite of required)
    if (!existsSync(`tests/e2e/${suite}.spec.ts`))
      throw new Error(`Required T34 suite is not implemented: ${suite}`)
  const require = createRequire(import.meta.url)
  const output = resolve('output/staging-e2e', new Date().toISOString().replaceAll(':', '-'))
  mkdirSync(output, { recursive: true })
  const config = resolve(output, 'playwright.config.cjs')
  const playwright = require.resolve('@playwright/test')
  writeFileSync(
    config,
    `const { devices } = require(${JSON.stringify(playwright)}); module.exports = { testDir: ${JSON.stringify(resolve('tests/e2e'))}, outputDir: ${JSON.stringify(resolve(output, 'results'))}, fullyParallel: false, workers: 1, retries: 0, timeout: 30000, use: { baseURL: ${JSON.stringify(target.origin)}, trace: 'off', screenshot: 'only-on-failure', video: 'retain-on-failure' }, projects: [{name:'chromium-desktop',use:{...devices['Desktop Chrome']}},{name:'chromium-mobile',use:{...devices['Pixel 7']}},{name:'webkit-mobile',use:{...devices['iPhone 14']}}] };\n`
  )
  const env = {
    ...process.env,
    LYSTO_E2E_BASE_URL: target.origin,
    APP_ENV: 'staging',
    MERCADOPAGO_MODE: 'test'
  }
  for (const key of Object.keys(env))
    if (key.startsWith('MERCADOPAGO_') && key !== 'MERCADOPAGO_MODE')
      delete (env as Record<string, string | undefined>)[key]
  const run = (listOnly: boolean) => {
    const reportPath = resolve(output, listOnly ? 'list.json' : 'result.json')
    const result = spawnSync(
      process.execPath,
      [
        require.resolve('@playwright/test/cli'),
        'test',
        '--config',
        config,
        ...(listOnly ? ['--list'] : []),
        '--reporter=json'
      ],
      { env: { ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath }, stdio: 'inherit' }
    )
    if (result.status !== 0) throw new Error('Staging Playwright process failed')
    return JSON.parse(readFileSync(reportPath, 'utf8')) as unknown
  }
  const requiredCoverage = {
    files: required.map((suite) => `${suite}.spec.ts`),
    projects: ['chromium-desktop', 'chromium-mobile', 'webkit-mobile']
  }
  const list = run(true)
  const listed = verifyPlaywrightCoverage(list, undefined, requiredCoverage)
  if (!args.includes('--list')) {
    const executed = verifyPlaywrightCoverage(list, run(false), requiredCoverage)
    console.log(
      `Staging suite completed: ${executed} tests; zero omitted. External release gates still require review.`
    )
  } else console.log(`Staging suite discovered: ${listed} tests; no execution evidence produced.`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Staging verification failed')
  process.exitCode = 1
}
