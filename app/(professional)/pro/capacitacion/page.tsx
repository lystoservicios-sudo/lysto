import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'

const modules = ['Protocolo de ingreso al domicilio', 'Checklist aire acondicionado split', 'Uso de fotos antes/después', 'Política de garantía Lysto', 'Cierre técnico y mantenimiento', 'Atención al cliente']
export default function ProfessionalTrainingPage() {
  return <PageScaffold title="Capacitación" eyebrow="Calidad profesional" description="Módulos internos para sostener el estándar de marca y respaldo Lysto."><div className="grid gap-4 lg:grid-cols-3">{modules.map((item, index) => <Card key={item}><p className="text-xs font-black text-blue-700">Módulo {index + 1}</p><p className="mt-2 font-black">{item}</p><p className="mt-2 text-sm text-slate-600">Estado: asignado / completado / vencido.</p></Card>)}</div></PageScaffold>
}
