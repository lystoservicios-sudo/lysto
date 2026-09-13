import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createTestServerEnvironment } from './lib/test-server-environment.mjs'

const require = createRequire(import.meta.url)
const target = new URL(process.env.LYSTO_E2E_BASE_URL ?? 'http://127.0.0.1:3100')
if (target.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(target.hostname) || !target.port || target.username || target.password || target.pathname !== '/' || target.search || target.hash) throw new Error('Local test origin required')
const env = { ...createTestServerEnvironment(process.env), NEXT_PUBLIC_APP_URL: target.origin, LYSTO_BUILD_DIR: '.next-e2e' }
const next = require.resolve('next/dist/bin/next')
const production = process.env.LYSTO_E2E_PRODUCTION === '1'
if (production) {
  const build = spawnSync(process.execPath, [next, 'build'], { env, stdio: 'inherit' })
  if (build.status !== 0) process.exit(build.status ?? 1)
}
const server = spawn(process.execPath, [next, production ? 'start' : 'dev', '--hostname', target.hostname, '--port', target.port], { env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal))
server.on('error', () => { process.exitCode = 1 })
server.on('exit', code => { process.exitCode = code ?? 1 })
