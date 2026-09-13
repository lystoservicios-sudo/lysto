import { LiveRecords } from '@/components/admin/live-operations'
import { requirePageSession } from '@/lib/auth/session'
import { adminCustomers } from '@/lib/operations/admin-console'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const { cursor } = await searchParams
  const page = await adminCustomers(await requirePageSession('admin'), { pageSize: 25, cursor })
  return (
    <LiveRecords
      title="Clientes"
      description="Perfiles reales visibles para operaciones."
      rows={page.items}
      href={(id) => `/admin/clientes/${id}`}
      total={page.total}
      nextHref={
        page.nextCursor
          ? `/admin/clientes?cursor=${encodeURIComponent(page.nextCursor)}`
          : undefined
      }
    />
  )
}
