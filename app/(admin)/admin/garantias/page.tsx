import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'

export default function AdminWarrantyPage() {
  return <PageScaffold title="Garantías" eyebrow="Postventa" description="Gestión de garantías vigentes, vencidas, aprobadas y rechazadas."><div className="grid gap-4 lg:grid-cols-4">{['Abiertas', 'En revisión', 'Aprobadas', 'Rechazadas'].map((item, index) => <Card key={item}><p className="text-3xl font-black">{[4,2,11,1][index]}</p><p className="text-sm font-bold text-slate-600">{item}</p></Card>)}</div></PageScaffold>
}
