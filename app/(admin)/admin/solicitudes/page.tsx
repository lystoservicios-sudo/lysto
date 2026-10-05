import { LiveRecords } from '@/components/admin/live-operations'
import { SavedQuotes } from '@/components/pricing/saved-quotes'
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
    <div className="space-y-8">
      <SavedQuotes
        internal
        canReview
        heading="Solicitudes de presupuesto de clientes"
        description="Los pedidos nuevos aparecen acá para que Operaciones revise alcance e importes. Después de aprobarlos, el cliente puede aceptarlos; el trabajo pasa a Matching para asignar un técnico."
      />
      <LiveRecords
        title="Solicitudes aceptadas"
        description="Servicios confirmados por el cliente que esperan gestión operativa."
        rows={rows.items}
        href={(id) => `/admin/solicitudes/${id}`}
        total={rows.total}
        nextHref={
          rows.nextCursor
            ? `/admin/solicitudes?cursor=${encodeURIComponent(rows.nextCursor)}`
            : undefined
        }
      />
    </div>
  )
}
