import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'

const reports = ['Conversión solicitud → pago', 'Margen por servicio', 'Tiempo a asignación', 'Aceptación profesional', 'Calidad y reclamos', 'Recompra por mantenimiento']
export default function AdminReportsPage() {
  return <PageScaffold title="Reportes" eyebrow="Dirección" description="Indicadores para operar y validar el modelo de negocio."><div className="grid gap-4 lg:grid-cols-3">{reports.map((report) => <Card key={report}><p className="font-black">{report}</p><p className="mt-2 text-sm text-slate-600">Preparado para leer de tablas operativas y eventos.</p></Card>)}</div></PageScaffold>
}
