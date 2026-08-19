import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'

const zones = ['CABA Norte', 'CABA Centro', 'CABA Sur', 'AMBA Norte', 'AMBA Oeste', 'AMBA Sur']
export default function AdminZonesPage() {
  return <PageScaffold title="Zonas operativas" eyebrow="Matching" description="Configuración de cobertura, precio por zona y disponibilidad profesional."><div className="grid gap-4 lg:grid-cols-3">{zones.map((zone) => <Card key={zone}><p className="font-black">{zone}</p><p className="mt-2 text-sm text-slate-600">Activa · afecta matching, precio y SLA.</p></Card>)}</div></PageScaffold>
}
