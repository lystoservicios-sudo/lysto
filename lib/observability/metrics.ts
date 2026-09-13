import { logEvent } from './logger'
export function recordMetric(name: string, value: number, fields: Record<string, unknown> = {}) {
  if (!Number.isFinite(value)) return
  logEvent('info', 'metric', { name, value, ...fields })
}
export async function timed<T>(
  name: string,
  operation: () => Promise<T>,
  fields: Record<string, unknown> = {}
) {
  const started = performance.now()
  try {
    const result = await operation()
    recordMetric(name, performance.now() - started, { outcome: 'ok', ...fields })
    return result
  } catch (error) {
    recordMetric(name, performance.now() - started, { outcome: 'error', ...fields })
    throw error
  }
}
