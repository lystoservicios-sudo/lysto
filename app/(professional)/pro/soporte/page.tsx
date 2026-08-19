import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'

export default function ProfessionalSupportPage() {
  return <PageScaffold title="Soporte Lysto" eyebrow="Red de apoyo" description="Herramienta para pedir ayuda operativa, técnica o administrativa durante un servicio."><div className="grid gap-4 lg:grid-cols-3">{['Ayuda durante trabajo', 'Problema con cliente', 'Repuesto pendiente', 'Duda técnica', 'Pago/liquidación', 'Emergencia de seguridad'].map((item) => <Card key={item} className="font-bold">{item}</Card>)}</div></PageScaffold>
}
