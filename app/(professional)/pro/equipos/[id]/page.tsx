import { PageScaffold } from '@/components/layout/page-scaffold'
import { DetailGrid } from '@/components/dashboard/detail-grid'
import { equipment } from '@/lib/mock/lysto-data'

export default function ProfessionalEquipmentDetailPage() {
  const item = equipment[0]
  return (
    <PageScaffold title={`Equipo atendido: ${item.nickname}`} eyebrow="Profesional" description="Historial técnico disponible para profesionales asignados al cliente/equipo.">
      <DetailGrid items={[
        { label: 'Cliente', value: item.customer, helper: item.address },
        { label: 'Marca/modelo', value: `${item.brand} ${item.model}`, helper: item.type },
        { label: 'Último diagnóstico', value: item.lastDiagnosis, helper: item.lastService },
        { label: 'Próximo mantenimiento', value: item.nextMaintenance, helper: item.maintenanceOption },
        { label: 'Fotos', value: 'Interior/exterior', helper: 'Privadas con signed URL' },
        { label: 'Notas', value: 'Acceso por balcón', helper: 'Validar seguridad antes de trabajar' }
      ]} />
    </PageScaffold>
  )
}
