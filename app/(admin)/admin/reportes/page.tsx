import { OperationsDashboard } from '@/components/admin/live-operations'
import { requirePageSession } from '@/lib/auth/session'
import { listOperatorQueue } from '@/lib/operations/queue-service'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const session = await requirePageSession('admin')
  const { cursor } = await searchParams
  const queue = await listOperatorQueue(session, { pageSize: 25, cursor })
  return (
    <OperationsDashboard
      queue={queue}
      nextHref={
        queue.nextCursor
          ? `/admin/reportes?cursor=${encodeURIComponent(queue.nextCursor)}`
          : undefined
      }
    />
  )
}
