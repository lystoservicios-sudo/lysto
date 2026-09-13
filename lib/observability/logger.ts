const sensitiveKey =
  /(authorization|cookie|token|secret|password|email|phone|address|payload|body|raw|metadata)/i
function redactString(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, '[REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED]')
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[REDACTED]')
    .replace(/(?:token|secret|password|cookie)=\S+/gi, '[REDACTED]')
}
export function redactLogValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[REDACTED]'
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactLogValue(item, depth + 1))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [
          key,
          sensitiveKey.test(key) ? '[REDACTED]' : redactLogValue(item, depth + 1)
        ])
    )
  return value
}
export type LogLevel = 'info' | 'warn' | 'error'
export function currentRelease(env: Record<string, string | undefined> = process.env) {
  return env.VERCEL_GIT_COMMIT_SHA?.trim() || env.LYSTO_RELEASE?.trim() || 'local'
}
export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const record = redactLogValue({
    timestamp: new Date().toISOString(),
    level,
    event,
    release: currentRelease(),
    ...fields
  })
  const line = JSON.stringify(record)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}
