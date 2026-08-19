import { PageScaffold } from '@/components/layout/page-scaffold'
import { JobCard } from '@/components/business/job-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { jobs } from '@/lib/mock/lysto-data'

export default function CustomerJobDetailPage() {
  const job = jobs[0]
  return <PageScaffold title={`Trabajo ${job.id}`} eyebrow="Cliente" description="Seguimiento del técnico, comprobante, pago y acciones del cliente."><div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]"><JobCard job={job} /><Card className="space-y-4"><h2 className="text-xl font-black">Acciones del cliente</h2><Button className="w-full">Confirmar finalización</Button><Button className="w-full" variant="secondary">Ver comprobante / QR</Button><Button className="w-full" variant="secondary">Calificar servicio</Button><div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">Pago protegido por Lysto. Ante cualquier problema, el caso puede pasar a revisión de calidad.</div></Card></div></PageScaffold>
}
