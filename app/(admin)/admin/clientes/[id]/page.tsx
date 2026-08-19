import { PageScaffold } from '@/components/layout/page-scaffold'
import { EquipmentCard } from '@/components/business/equipment-card'
import { RequestCard } from '@/components/business/request-card'
import { equipment, requests } from '@/lib/mock/lysto-data'

export default function AdminCustomerDetailPage() {
  return <PageScaffold title="Ficha del cliente" eyebrow="Admin" description="Datos operativos del cliente, direcciones, historial de solicitudes y equipos registrados."><div className="grid gap-5 lg:grid-cols-2"><RequestCard request={requests[0]} /><EquipmentCard item={equipment[0]} /></div></PageScaffold>
}
