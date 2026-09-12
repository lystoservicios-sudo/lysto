import { LiveRecords } from '@/components/admin/live-operations'
import { requirePageSession } from '@/lib/auth/session'
import { adminResource } from '@/lib/operations/admin-console'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const { cursor } = await searchParams
  const rows = await adminResource(await requirePageSession('admin'), 'equipment', {
    pageSize: 25,
    cursor
  })
  return (
    <LiveRecords
      title="Equipos"
      description="Equipos registrados visibles para operaciones."
      rows={rows.items}
      total={rows.total}
      nextHref={
        rows.nextCursor ? `/admin/equipos?cursor=${encodeURIComponent(rows.nextCursor)}` : undefined
      }
    />
  )
}
