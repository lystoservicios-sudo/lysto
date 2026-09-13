import { spawn, execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, openSync, closeSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'node:net'
import { once } from 'node:events'
import {
  combineChunks,
  createChunks,
  createServerClient,
  isChunkLike,
  stringFromBase64URL,
  stringToBase64URL,
  type SetAllCookies
} from '@supabase/ssr'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { createTestServerEnvironment } from '../../scripts/lib/test-server-environment.mjs'
import type { FixtureAccount } from './fixtures'

const require = createRequire(import.meta.url)

export async function fixtureCookieHeader(
  account: Pick<FixtureAccount, 'accessToken' | 'refreshToken'>,
  options: { forceRefresh?: boolean } = {}
) {
  const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
  const jar = new Map<string, string>()
  const client = createServerClient(target.apiUrl, process.env.LYSTO_TEST_ANON_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values: Parameters<SetAllCookies>[0]) => {
        for (const cookie of values) jar.set(cookie.name, cookie.value)
      }
    },
    auth: { autoRefreshToken: false }
  })
  const { error } = await client.auth.setSession({
    access_token: account.accessToken,
    refresh_token: account.refreshToken
  })
  if (error || !jar.size) throw new Error('Could not create real SSR test cookies')
  if (options.forceRefresh) {
    const keys = new Set(
      [...jar.keys()]
        .filter((name) => /-auth-token(?:\.\d+)?$/.test(name))
        .map((name) => name.replace(/\.\d+$/, ''))
    )
    if (keys.size !== 1) throw new Error('Expected one real SSR session cookie')
    const key = [...keys][0]
    const encoded = await combineChunks(key, (name) => jar.get(name))
    if (!encoded) throw new Error('Real SSR session cookie is missing')
    const session = JSON.parse(
      encoded.startsWith('base64-') ? stringFromBase64URL(encoded.slice(7)) : encoded
    )
    if (
      session.access_token !== account.accessToken ||
      session.refresh_token !== account.refreshToken
    )
      throw new Error('Real SSR session credentials changed before refresh test')
    // Age only unsigned client metadata to trigger the installed Auth client's
    // refresh path. Keep the actual Auth-issued JWT and refresh token intact.
    session.expires_at = Math.floor(Date.now() / 1000) - 60
    const refreshed = `base64-${stringToBase64URL(JSON.stringify(session))}`
    for (const name of jar.keys()) if (isChunkLike(name, key)) jar.delete(name)
    for (const cookie of createChunks(key, refreshed)) jar.set(cookie.name, cookie.value)
  }
  return [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ')
}

export async function startTestApp() {
  const environment = createTestServerEnvironment(process.env)
  const url = new URL(process.env.LYSTO_E2E_BASE_URL ?? 'http://127.0.0.1:3100')
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Local HTTP test origin required')
  const portCheck = createServer()
  await new Promise<void>((resolveReady, reject) => {
    portCheck.once('error', reject)
    portCheck.listen(Number(url.port), url.hostname, () => portCheck.close(() => resolveReady()))
  })
  mkdirSync('output/integration', { recursive: true })
  const logPath = resolve('output/integration', `http-${Date.now()}.log`)
  const log = openSync(logPath, 'w')
  const server = spawn(
    process.execPath,
    [require.resolve('next/dist/bin/next'), 'dev', '--hostname', url.hostname, '--port', url.port],
    {
      env: {
        ...environment,
        NODE_ENV: 'development',
        NEXT_PUBLIC_APP_URL: url.origin,
        LYSTO_BUILD_DIR: '.next-integration',
        NEXT_TELEMETRY_DISABLED: '1'
      },
      stdio: ['ignore', log, log],
      detached: process.platform !== 'win32'
    }
  )
  closeSync(log)
  let launchError: Error | undefined
  server.on('error', (error) => {
    launchError = error
  })
  const stop = async () => {
    if (!server.pid || server.exitCode !== null || server.signalCode !== null) return
    const exited = once(server, 'exit')
    if (process.platform === 'win32')
      await new Promise<void>((done) =>
        execFile('taskkill', ['/PID', String(server.pid), '/T', '/F'], () => done())
      )
    else process.kill(-server.pid, 'SIGTERM')
    await exited
  }
  try {
    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      if (launchError || server.exitCode !== null || server.signalCode !== null)
        throw new Error(`Test app failed to start; inspect ${logPath}`)
      try {
        const response = await fetch(url.origin, { signal: AbortSignal.timeout(5_000) })
        if (response.ok) return { baseURL: url.origin, stop, logPath }
      } catch {
        /* Wait for the local compiler only. */
      }
      await new Promise((done) => setTimeout(done, 500))
    }
    throw new Error(`Test app readiness timed out; inspect ${logPath}`)
  } catch (error) {
    await stop()
    throw error
  }
}
