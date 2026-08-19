import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ProfessionalMercadoPagoPage() {
  return (
    <PageScaffold title="Mercado Pago profesional" eyebrow="Profesional" description="Vinculación OAuth para split, liquidaciones y trazabilidad de pagos.">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="text-xl font-black">Estado de conexión</h2><p className="mt-2 text-sm leading-6 text-slate-600">La cuenta todavía no está conectada. Al conectar, Lysto guardará tokens cifrados y podrá calcular split/liquidaciones según configuración admin.</p><div className="mt-5"><Button>Conectar Mercado Pago</Button></div></Card>
        <Card className="p-5"><h2 className="text-xl font-black">Split previsto</h2><ul className="mt-4 space-y-2 text-sm text-slate-600"><li>• Cliente paga a través de Lysto.</li><li>• Se calcula comisión de plataforma.</li><li>• Se registra monto profesional.</li><li>• Webhooks idempotentes actualizan estado.</li></ul></Card>
      </div>
    </PageScaffold>
  )
}
