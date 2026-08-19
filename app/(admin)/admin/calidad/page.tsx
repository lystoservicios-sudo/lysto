import { PageScaffold } from '@/components/layout/page-scaffold'
import { MetricGrid } from '@/components/business/metric-card'
import { RecordList, RecordRow } from '@/components/business/record-list'

const metrics = [{ label: 'Reviews promedio', value: '4.8', helper: 'Últimos 30 días', tone: 'green' as const }, { label: 'Garantías abiertas', value: '1', helper: 'Requiere seguimiento', tone: 'amber' as const }, { label: 'Disputas', value: '1', helper: 'Pago en revisión', tone: 'red' as const }]
export default function AdminQualityPage() {
  return <PageScaffold title="Calidad" eyebrow="Admin" description="Reviews, reclamos, garantías, reincidencias y score profesional."><MetricGrid metrics={metrics} /><RecordList title="Casos activos"><RecordRow title="Garantía JOB-5003" subtitle="Cliente reporta que volvió la pérdida de agua." meta="Alta prioridad" /><RecordRow title="Demora JOB-5001" subtitle="Profesional llegó fuera de franja horaria." meta="Impacta score" /></RecordList></PageScaffold>
}
