import { notFound } from 'next/navigation'
import { ActionLink, Header, Panel } from '@/components/admin/admin-ui'
import { requirePageSession } from '@/lib/auth/session'
import { adminCustomerDetail } from '@/lib/operations/admin-console'
import { z } from 'zod'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const session = await requirePageSession('admin')
  const record = await adminCustomerDetail(session, id)
  const canCreate = session.permissions.includes('owner') || (session.permissions.includes('operations') && session.permissions.includes('finance'))
  if (!record) notFound()
  return (
    <>
      <Header
        title={`${record.profile.first_name} ${record.profile.last_name}`}
        description="Contexto operativo del cliente."
        action={canCreate ? <ActionLink href={`/admin/solicitudes/nueva?customerId=${id}`} primary>Crear solicitud</ActionLink> : undefined}
      />
      <div className="adm-two-col">
        <Panel title="Contacto">
          <p>{record.profile.email}</p>
          <p>{record.profile.phone ?? 'Sin teléfono'}</p>
        </Panel>
        <Panel title="Actividad">
          <p>{record.requests.length} solicitudes recientes</p>
          <p>{record.equipment.length} equipos recientes</p>
        </Panel>
      </div>
    </>
  )
}
