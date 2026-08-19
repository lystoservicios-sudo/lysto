import { PublicShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'

const faqs = [
  ['¿El diagnóstico preliminar es final?', 'No. Ayuda a orientar el servicio, pero el técnico confirma en el domicilio.'],
  ['¿Quién entra a mi casa?', 'Profesionales invitados, revisados y aprobados por Lysto.'],
  ['¿Qué pasa si hay que hacer otra reparación?', 'El profesional carga el diagnóstico real y presupuesto adicional antes de avanzar.'],
  ['¿Hay comprobante?', 'Sí. Al cierre se genera comprobante con QR, trabajo realizado y mantenimiento recomendado.']
]

export default function HelpPage() {
  return (
    <PublicShell><main className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><h1 className="text-4xl font-black text-slate-950">Ayuda</h1><div className="mt-8 grid gap-4">{faqs.map(([q, a]) => <Card key={q} className="p-5"><h2 className="font-black">{q}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{a}</p></Card>)}</div></main></PublicShell>
  )
}
