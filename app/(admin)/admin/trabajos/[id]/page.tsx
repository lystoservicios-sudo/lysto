import { PageScaffold } from '@/components/layout/page-scaffold'
import { ProfessionalWorkbench } from '@/components/business/workbench'
import { JobCard } from '@/components/business/job-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { jobs } from '@/lib/mock/lysto-data'

export default function AdminJobDetailPage() {
  const job = jobs[0]
  return <PageScaffold title={`Trabajo ${job.id}`} eyebrow="Admin" description="Control total del trabajo: estado, pago, profesional, cliente, cierre, disputa y garantía."><div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]"><div className="space-y-5"><JobCard job={job} /><ProfessionalWorkbench job={job} /></div><Card className="space-y-3"><h2 className="text-xl font-black">Acciones admin</h2><Button className="w-full">Reasignar profesional</Button><Button className="w-full" variant="secondary">Abrir caso calidad</Button><Button className="w-full" variant="secondary">Emitir devolución manual</Button><Button className="w-full" variant="danger">Cancelar trabajo</Button></Card></div></PageScaffold>
}
