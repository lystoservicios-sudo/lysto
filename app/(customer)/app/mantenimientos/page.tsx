import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { equipment } from '@/lib/mock/lysto-data'

export default function CustomerMaintenancePage() {
  return (
    <PageScaffold title="Mantenimientos recomendados" eyebrow="Postventa" description="Recordatorios generados desde el cierre técnico del profesional.">
      <div className="grid gap-4 lg:grid-cols-3">{equipment.map((item) => <Card key={item.id}><p className="font-black">{item.nickname}</p><p className="mt-1 text-sm text-slate-600">{item.brand} {item.model}</p><p className="mt-4 text-sm font-bold text-amber-700">Próximo: {item.nextMaintenance}</p></Card>)}</div>
    </PageScaffold>
  )
}
