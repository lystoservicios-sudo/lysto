import { notFound } from 'next/navigation'
import { Header, Panel } from '@/components/admin/admin-ui'
import { requirePageSession } from '@/lib/auth/session'
import { adminCustomerDetail } from '@/lib/operations/admin-console'
import { z } from 'zod'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const record = await adminCustomerDetail(await requirePageSession('admin'), id)
  if (!record) notFound()
  return (
    <>
      <Header
        title={`${record.profile.first_name} ${record.profile.last_name}`}
        description="Contexto operativo del cliente."
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
