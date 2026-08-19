import { PageScaffold } from '@/components/layout/page-scaffold'
import { RequestCard } from '@/components/business/request-card'
import { ProfessionalCard } from '@/components/business/professional-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requests, professionals } from '@/lib/mock/lysto-data'

export default function AdminRequestDetailPage() {
  const request = requests[0]
  return <PageScaffold title={`Solicitud ${request.id}`} eyebrow="Admin" description="Detalle operativo para asignar, reasignar, cancelar o revisar diagnóstico/pago."><div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]"><RequestCard request={request} /><Card className="space-y-4"><h2 className="text-xl font-black">Matching sugerido</h2>{professionals.map((pro) => <ProfessionalCard key={pro.id} professional={pro} />)}<Button className="w-full">Asignar mejor candidato</Button><Button className="w-full" variant="secondary">Reasignar manualmente</Button></Card></div></PageScaffold>
}
