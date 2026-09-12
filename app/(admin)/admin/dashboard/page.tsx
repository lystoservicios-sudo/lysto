import { OperationsDashboard } from '@/components/admin/live-operations'
import { requirePageSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { listOperatorQueue } from '@/lib/operations/queue-service'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const session = await requirePageSession('admin')
  if (!session.permissions.some((permission) => ['owner', 'operations'].includes(permission))) {
    if (session.permissions.includes('finance')) redirect('/admin/pagos')
    if (session.permissions.includes('quality')) redirect('/admin/calidad')
  }
  const { cursor } = await searchParams
  const queue = await listOperatorQueue(session, { pageSize: 25, cursor })
  return (
    <OperationsDashboard
      queue={queue}
      nextHref={
        queue.nextCursor
          ? `/admin/dashboard?cursor=${encodeURIComponent(queue.nextCursor)}`
          : undefined
      }
    />
  )
}
