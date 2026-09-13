import { privateJson } from '@/lib/http/api-error'
import { authorizeOutboxWorker, readOutboxBody } from '@/lib/notifications/worker-auth'
import { dispatchRefunds } from '@/lib/payments/refund-server'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request) {
  if (
    !authorizeOutboxWorker(
      request.headers.get('authorization'),
      process.env.REFUND_WORKER_SECRET,
      process.env.REFUND_WORKER_ENABLED === 'true'
    )
  )
    return privateJson({ error: 'Worker no disponible.' }, { status: 403 })
  try {
    const { batchSize } = await readOutboxBody(request)
    return privateJson(await dispatchRefunds(batchSize))
  } catch {
    return privateJson(
      {
        error:
          'No se pudo completar el lote; las operaciones inciertas conservan su clave idempotente.'
      },
      { status: 503 }
    )
  }
}
