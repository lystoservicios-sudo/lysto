import { LiveRecords } from '@/components/admin/live-operations'
import { requirePageSession } from '@/lib/auth/session'
import { adminResource } from '@/lib/operations/admin-console'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const { cursor } = await searchParams
  const rows = await adminResource(await requirePageSession('admin'), 'jobs', {
    pageSize: 25,
    cursor
  })
  return (
    <LiveRecords
      title="Trabajos"
      description="Trabajos reales y su estado operativo."
      rows={rows.items}
      href={(id) => `/admin/trabajos/${id}`}
      total={rows.total}
      nextHref={
        rows.nextCursor
          ? `/admin/trabajos?cursor=${encodeURIComponent(rows.nextCursor)}`
          : undefined
      }
    />
  )
}
