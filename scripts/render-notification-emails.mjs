import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const requested = process.argv.indexOf('--output')
const output = resolve(
  requested >= 0 && process.argv[requested + 1]
    ? process.argv[requested + 1]
    : `output/email-preview/${new Date().toISOString().replaceAll(':', '-')}`
)
const require = createRequire(import.meta.url)
const result = spawnSync(
  process.execPath,
  [require.resolve('vitest/vitest.mjs'), 'run', '--config', 'vitest.email.config.ts'],
  {
    cwd: process.cwd(),
    env: { ...process.env, EMAIL_PREVIEW_OUTPUT: output },
    stdio: 'inherit'
  }
)
if (result.status !== 0) process.exitCode = result.status ?? 1
else process.stdout.write(`${output}\n`)
