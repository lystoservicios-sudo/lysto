import { LiveRecords } from '@/components/admin/live-operations'
import { SavedQuotes } from '@/components/pricing/saved-quotes'
import { requirePageSession } from '@/lib/auth/session'
import { adminResource } from '@/lib/operations/admin-console'
import { ManagedServiceRequestList } from '@/components/admin/managed-service-request-list'
import { readAdminRequests } from '@/lib/admin/service-request-service'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ cursor?: string; managedCursor?: string }>
}) {
  const { cursor, managedCursor } = await searchParams
  const session = await requirePageSession('admin')
  const canCreate = session.permissions.includes('owner') || (session.permissions.includes('operations') && session.permissions.includes('finance'))
  const rows = await adminResource(session, 'requests', {
    pageSize: 25,
    cursor
  })
  const managed = canCreate ? await readAdminRequests(session, undefined, { cursor: managedCursor }) : null
  return (
    <div className="space-y-8">
      {managed ? <ManagedServiceRequestList records={managed.items} total={managed.total} nextHref={managed.nextCursor
        ? `/admin/solicitudes?${new URLSearchParams({ ...(cursor ? { cursor } : {}), managedCursor: managed.nextCursor })}`
        : undefined} /> : null}
      <SavedQuotes
        internal
        canReview
        heading="Solicitudes de presupuesto de clientes"
        description="Los pedidos nuevos aparecen acá para que Operaciones revise alcance e importes. Después de aprobarlos, el cliente puede aceptarlos; el trabajo pasa a Matching para asignar un técnico."
      />
      <LiveRecords
        title="Solicitudes en gestión"
        description="Solicitudes registradas y servicios que requieren seguimiento operativo."
        rows={rows.items}
        href={(id) => `/admin/solicitudes/${id}`}
        total={rows.total}
        nextHref={
          rows.nextCursor
            ? `/admin/solicitudes?${new URLSearchParams({ cursor: rows.nextCursor, ...(managedCursor ? { managedCursor } : {}) })}`
            : undefined
        }
      />
    </div>
  )
}
