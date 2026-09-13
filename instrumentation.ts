import { logEvent } from '@/lib/observability/logger'
export async function register() {
  logEvent('info', 'runtime.started', { runtime: process.env.NEXT_RUNTIME ?? 'nodejs' })
}
export function onRequestError(
  error: unknown,
  request: { path?: string },
  context: { routeType?: string }
) {
  logEvent('error', 'request.unhandled', {
    code: error instanceof Error ? error.name : 'unknown_error',
    resource: request.path?.split('?')[0],
    routeType: context.routeType
  })
}
