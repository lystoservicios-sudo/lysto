import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { qualityItems } from '@/lib/mock/lysto-data'

export default function AdminComplaintsPage() {
  return <PageScaffold title="Reclamos" eyebrow="Calidad" description="Cola de reclamos, disputas y casos críticos."><div className="grid gap-4">{qualityItems.map((item) => <Card key={item.title}><p className="font-black">{item.title}</p><p className="text-sm text-slate-600">{item.detail}</p><p className="mt-3 text-xs font-bold text-red-700">SLA: revisar antes de 2 horas si afecta seguridad o garantía.</p></Card>)}</div></PageScaffold>
}
