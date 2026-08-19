import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { qualityItems } from '@/lib/mock/lysto-data'

export default function CustomerWarrantyPage() {
  return (
    <PageScaffold title="Garantías" eyebrow="Respaldo Lysto" description="Vista del cliente para consultar garantías vigentes, vencimientos y abrir reclamos por reincidencia.">
      <div className="grid gap-4 lg:grid-cols-3">{qualityItems.map((item) => <Card key={item.title}><p className="font-black">{item.title}</p><p className="mt-2 text-sm text-slate-600">{item.detail}</p><p className="mt-4 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{item.status}</p></Card>)}</div>
    </PageScaffold>
  )
}
