import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'

const settings = ['Comisión Lysto', 'Flexible/Prioridad', 'Split Mercado Pago', 'Liquidación profesional', 'Política de devolución', 'Garantía por servicio']
export default function AdminMarketplacePage() {
  return <PageScaffold title="Marketplace" eyebrow="Modelo comercial" description="Configuración comercial de comisión, pagos, split y reglas de operación."><div className="grid gap-4 lg:grid-cols-3">{settings.map((setting) => <Card key={setting}><p className="font-black">{setting}</p><p className="mt-2 text-sm text-slate-600">Editable por admin autorizado y auditado.</p></Card>)}</div></PageScaffold>
}
