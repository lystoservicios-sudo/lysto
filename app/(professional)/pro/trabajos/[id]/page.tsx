import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { DetailGrid } from '@/components/dashboard/detail-grid'
import { StatusTimeline } from '@/components/status/status-timeline'
import { jobs, money } from '@/lib/mock/lysto-data'

export default function ProfessionalJobDetailPage() {
  const job = jobs[0]
  return (
    <PageScaffold title={`Operar trabajo ${job.id}`} eyebrow="Profesional" description="Panel para avanzar estados, registrar equipo, cerrar diagnóstico real y generar comprobante.">
      <Card className="p-5"><StatusTimeline current={2} steps={['Aceptado', 'En camino', 'Llegué', 'Diagnóstico', 'Trabajo en curso', 'Cierre técnico']} /></Card>
      <DetailGrid items={[
        { label: 'Cliente', value: job.customer, helper: job.address },
        { label: 'Equipo', value: job.equipment, helper: job.issueLabel },
        { label: 'Horario', value: `${job.scheduled} · ${job.timeWindow}`, helper: 'Llegar dentro de la franja mejora score' },
        { label: 'Importe', value: money(job.amount), helper: 'Reserva base' },
        { label: 'Próximo paso', value: job.nextStep, helper: 'No saltear estados' },
        { label: 'Soporte', value: 'Disponible', helper: 'Usar si hay conflicto o repuesto' }
      ]} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="text-xl font-black">Estados rápidos</h2><div className="mt-4 grid gap-2"><Button>Marcar “en camino”</Button><Button variant="secondary">Llegué al domicilio</Button><Button variant="secondary">Iniciar diagnóstico</Button><Button variant="secondary">Trabajo terminado</Button></div></Card>
        <Card className="p-5"><h2 className="text-xl font-black">Registrar equipo</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Nombre del equipo"><Input defaultValue="Aire living" /></Field><Field label="Marca"><Input defaultValue="Surrey" /></Field><Field label="Modelo"><Input placeholder="Modelo" /></Field><Field label="Tipo"><Input defaultValue="Split inverter" /></Field></div></Card>
      </div>
      <Card className="p-5"><h2 className="text-xl font-black">Cierre técnico</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Diagnóstico real"><Input placeholder="Carga de gas baja / fuga / filtros..." /></Field><Field label="Trabajo realizado"><Input placeholder="Limpieza, revisión, reparación..." /></Field><Field label="Repuestos usados"><Input placeholder="Opcional" /></Field><Field label="Mantenimiento recomendado"><Input defaultValue="Limpieza profunda en 6 meses" /></Field></div><div className="mt-5"><Button>Guardar cierre y generar QR</Button></div></Card>
    </PageScaffold>
  )
}
