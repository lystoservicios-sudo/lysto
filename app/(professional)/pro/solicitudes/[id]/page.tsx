import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DetailGrid } from '@/components/dashboard/detail-grid'
import { serviceRequests, money } from '@/lib/mock/lysto-data'

export default function ProfessionalRequestDetailPage() {
  const request = serviceRequests[0]
  return (
    <PageScaffold title={`Solicitud ${request.id}`} eyebrow="Profesional" description="Información necesaria para aceptar o rechazar sin comprometer calidad ni puntualidad.">
      <DetailGrid items={[
        { label: 'Cliente', value: request.customer, helper: 'Datos de contacto habilitados al aceptar' },
        { label: 'Problema', value: request.issueLabel, helper: request.diagnosis },
        { label: 'Dirección', value: request.address, helper: 'Revisar distancia y acceso' },
        { label: 'Horario', value: request.timeWindow, helper: request.urgency },
        { label: 'Importe', value: money(request.price), helper: 'Reserva preliminar' },
        { label: 'Archivos', value: '3 fotos · 1 video', helper: 'Opcionales cargados por cliente' }
      ]} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="text-xl font-black">Informe interno</h2><p className="mt-2 text-sm leading-6 text-slate-600">Revisar presión, filtros, unidad exterior y consumo eléctrico. Confirmar diagnóstico presencial antes de prometer reparación final.</p></Card>
        <Card className="p-5"><h2 className="text-xl font-black">Respuesta</h2><div className="mt-4 grid gap-2"><Button>Aceptar solicitud</Button><Button variant="secondary">Rechazar por agenda</Button><Button variant="secondary">Pedir revisión admin</Button></div></Card>
      </div>
    </PageScaffold>
  )
}
