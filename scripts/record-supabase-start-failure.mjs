import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

const redacted = '[REDACTED]'
const credentialMarker = /authorization|cookie|jwt|password|passwd|api[_ -]?key|access[_ -]?key|anon[_ -]?key|service[_ -]?role|secret|token|publishable/i
const statusMarker = /\b(?:api|database|db|studio|inbucket|mailpit|project|graphql|storage)\s+url\s*[:|│]/i
const environmentAssignment = /^\s*(?:export\s+)?[A-Z][A-Z0-9_]*\s*=/

/** Logs are untrusted: keep failure context, never emit credentials or CLI status. */
export function sanitizeSupabaseStartFailure(raw) {
  const withoutTerminalControls = stripVTControlCharacters(String(raw)).replace(/\r\n?/g, '\n')
  const withoutKeys = withoutTerminalControls
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, redacted)
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, candidate => {
      try {
        const url = new URL(candidate)
        if (url.username || url.password || [...url.searchParams.keys()].some(key => /token|secret|password|key|auth|credential/i.test(key))) return redacted
        return candidate
      } catch {
        return candidate.includes('@') || /^postgres(?:ql)?:/i.test(candidate) ? redacted : candidate
      }
    })
    .replace(/\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, redacted)
    .replace(/\b(?:sb_(?:secret|publishable)_|github_pat_|gh[pousr]_)[A-Za-z0-9_-]+\b/gi, redacted)
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{8,}\b/g, redacted)
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, redacted)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  const lines = withoutKeys.split('\n').map(line => {
    if (credentialMarker.test(line) || statusMarker.test(line) || environmentAssignment.test(line)) {
      const sqlstate = line.match(/SQLSTATE\s+[A-Z0-9]{5}/i)?.[0]
      return sqlstate ? `${redacted} (${sqlstate})` : redacted
    }
    return line
  })
  return `${lines.slice(-2000).join('\n').slice(-65536).trim()}\n`
}

function recordFailure(source) {
  if (process.env.CI !== 'true' || !process.env.RUNNER_TEMP || !source) throw new Error('Explicit CI runner log required')
  const runnerTemp = realpathSync(process.env.RUNNER_TEMP)
  const expected = join(runnerTemp, 'supabase-start.log')
  if (realpathSync(resolve(source)) !== expected || statSync(expected).size > 8 * 1024 * 1024) throw new Error('Unexpected startup log')
  const safe = sanitizeSupabaseStartFailure(readFileSync(expected, 'utf8'))
  mkdirSync('output/ci', { recursive: true })
  writeFileSync('output/ci/supabase-start-failure.log', `Supabase startup failed. Only sanitized diagnostic evidence follows.\n${safe}`, { mode: 0o600 })
  console.log('Sanitized Supabase startup failure evidence recorded; the startup remains failed.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { recordFailure(process.argv[2]) }
  catch {
    console.error('Safe Supabase startup diagnostics could not be recorded. No raw log was published.')
    process.exitCode = 1
  }
}
