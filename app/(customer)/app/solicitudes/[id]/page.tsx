import { PageScaffold } from '@/components/layout/page-scaffold'
import { RequestCard } from '@/components/business/request-card'
import { Card } from '@/components/ui/card'
import { requests } from '@/lib/mock/lysto-data'

export default function CustomerRequestDetailPage() {
  const request = requests[0]
  return <PageScaffold title={`Solicitud ${request.id}`} eyebrow="Cliente" description="Detalle de diagnóstico, dirección, archivos, presupuesto elegido y estado de matching."><div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]"><RequestCard request={request} href="/app/trabajos/JOB-5009" /><Card><h2 className="text-xl font-black">Informe interno resumido</h2><p className="mt-3 text-sm leading-6 text-slate-600">{request.diagnosis}</p><div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900"><strong>Cliente ve:</strong> diagnóstico preliminar con nivel de coincidencia. <br /><strong>Profesional ve:</strong> checklist técnico, fotos, video y datos de acceso.</div></Card></div></PageScaffold>
}
