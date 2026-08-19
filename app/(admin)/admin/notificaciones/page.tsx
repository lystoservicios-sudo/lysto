import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'

const events = ['Pago aprobado', 'Profesional asignado', 'Profesional en camino', 'Trabajo finalizado', 'Review pendiente', 'Mantenimiento próximo']
export default function AdminNotificationsPage() {
  return <PageScaffold title="Notificaciones" eyebrow="Automatización" description="Centro para auditar eventos que generan email, WhatsApp o notificaciones internas."><div className="grid gap-4 lg:grid-cols-3">{events.map((event) => <Card key={event}><p className="font-black">{event}</p><p className="mt-2 text-sm text-slate-600">Canales: app interna, email y WhatsApp semiautomático.</p></Card>)}</div></PageScaffold>
}
