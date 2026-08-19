import { PageScaffold } from '@/components/layout/page-scaffold'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MetricGrid } from '@/components/business/metric-card'
import { JobCard } from '@/components/business/job-card'
import { EquipmentCard } from '@/components/business/equipment-card'
import { customerMetrics, equipment, jobs } from '@/lib/mock/lysto-data'

export default function CustomerDashboardPage() {
  return (
    <PageScaffold title="Panel del cliente" eyebrow="Cliente" description="Centro para solicitar servicios, seguir trabajos, ver equipos registrados, pagos y mantenimientos.">
      <MetricGrid metrics={customerMetrics} />
      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Card className="bg-blue-600 text-white"><p className="text-sm font-bold uppercase tracking-wide text-blue-100">Aire acondicionado</p><h2 className="mt-2 text-3xl font-black">Pedí un técnico verificado</h2><p className="mt-3 text-sm leading-6 text-blue-50">Diagnóstico preliminar, presupuesto, pago protegido, seguimiento y garantía Lysto.</p><div className="mt-6"><ButtonLink href="/app/solicitar/aire-acondicionado" variant="secondary">Nueva solicitud</ButtonLink></div></Card>
        <JobCard job={jobs[0]} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">{equipment.map((item) => <EquipmentCard key={item.id} item={item} />)}</div>
    </PageScaffold>
  )
}
