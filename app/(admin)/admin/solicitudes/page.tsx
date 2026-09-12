import { LiveRecords } from '@/components/admin/live-operations'
import { requirePageSession } from '@/lib/auth/session'
import { adminResource } from '@/lib/operations/admin-console'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const { cursor } = await searchParams
  const rows = await adminResource(await requirePageSession('admin'), 'requests', {
    pageSize: 25,
    cursor
  })
  return (
    <LiveRecords
      title="Solicitudes"
      description="Solicitudes reales disponibles para operaciones."
      rows={rows.items}
      href={(id) => `/admin/solicitudes/${id}`}
      total={rows.total}
      nextHref={
        rows.nextCursor
          ? `/admin/solicitudes?cursor=${encodeURIComponent(rows.nextCursor)}`
          : undefined
      }
    />
  )
}
