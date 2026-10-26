import { privateJson } from '@/lib/http/api-error'
import { authorizeOutboxWorker, readOutboxBody } from '@/lib/notifications/worker-auth'
import { dispatchNotifications } from '@/lib/notifications/server'

export const runtime = 'nodejs'
export const maxDuration = 60

async function runBatch(batchSize: number, inAppOnly = false) {
  try {
    return privateJson(await (inAppOnly
      ? dispatchNotifications(batchSize, undefined, { inAppOnly: true })
      : dispatchNotifications(batchSize)))
  } catch {
    return privateJson(
      { error: 'No se pudo completar el lote; los leases pendientes podrán recuperarse.' },
      { status: 503 }
    )
  }
}

export async function GET(request: Request) {
  if (
    !authorizeOutboxWorker(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
      process.env.OUTBOX_WORKER_ENABLED === 'true'
    )
  )
    return privateJson({ error: 'Worker no disponible.' }, { status: 403 })
  return runBatch(5)
}

export async function POST(request: Request) {
  if (
    !authorizeOutboxWorker(
      request.headers.get('authorization'),
      process.env.OUTBOX_WORKER_SECRET,
      process.env.OUTBOX_WORKER_ENABLED === 'true'
    )
  )
    return privateJson({ error: 'Worker no disponible.' }, { status: 403 })
  let input: { batchSize: number; inAppOnly?: boolean }
  try {
    input = await readOutboxBody(request, { allowInAppOnly: true })
  } catch {
    return privateJson({ error: 'Solicitud inválida.' }, { status: 400 })
  }
  return runBatch(input.batchSize, input.inAppOnly)
}
